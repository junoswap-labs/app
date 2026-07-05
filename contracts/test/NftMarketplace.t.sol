// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {NftMarketplace} from "../src/NftMarketplace.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC721} from "./mocks/MockERC721.sol";

contract NftMarketplaceTest is Test {
    NftMarketplace internal market;
    MockERC20 internal pay;
    MockERC721 internal nft;

    uint256 internal sellerPk = 0xA11CE;
    address internal seller;
    address internal buyer = address(0xB0B);
    address internal feeCollector = address(0xFEE);

    uint256 internal constant FEE_BPS = 250; // 2.5%
    uint256 internal constant PRICE = 100 ether;
    uint256 internal constant TOKEN_ID = 1;

    function setUp() public {
        seller = vm.addr(sellerPk);
        market = new NftMarketplace(FEE_BPS, feeCollector);

        pay = new MockERC20();
        nft = new MockERC721();

        market.setAllowedPaymentToken(address(pay), true);

        nft.mint(seller, TOKEN_ID);
        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);

        pay.mint(buyer, 1_000 ether);
        vm.prank(buyer);
        pay.approve(address(market), type(uint256).max);
    }

    function _order() internal view returns (NftMarketplace.Order memory) {
        return NftMarketplace.Order({
            seller: seller,
            nftContract: address(nft),
            tokenId: TOKEN_ID,
            paymentToken: address(pay),
            price: PRICE,
            nonce: 12345,
            expiry: block.timestamp + 1 days
        });
    }

    function _sign(uint256 pk, NftMarketplace.Order memory order) internal view returns (bytes memory) {
        bytes32 digest = market.orderDigest(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testFulfillHappyPath() public {
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        vm.prank(buyer);
        market.fulfillOrder(order, sig);

        uint256 fee = (PRICE * FEE_BPS) / 10000;
        assertEq(nft.ownerOf(TOKEN_ID), buyer, "nft to buyer");
        assertEq(pay.balanceOf(seller), PRICE - fee, "seller proceeds");
        assertEq(pay.balanceOf(feeCollector), fee, "fee collected");
        assertTrue(market.cancelledOrFilled(market.hashOrder(order)), "order consumed");
    }

    function testReplayReverts() public {
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        vm.prank(buyer);
        market.fulfillOrder(order, sig);

        // A second fulfil of the same signed order (replay / double-fulfil race) must fail.
        vm.prank(buyer);
        vm.expectRevert("order inactive");
        market.fulfillOrder(order, sig);
    }

    function testExpiredReverts() public {
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        vm.warp(order.expiry + 1);
        vm.prank(buyer);
        vm.expectRevert("order expired");
        market.fulfillOrder(order, sig);
    }

    function testCancelledOrderCannotBeFulfilled() public {
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        vm.prank(seller);
        market.cancelOrder(order);

        vm.prank(buyer);
        vm.expectRevert("order inactive");
        market.fulfillOrder(order, sig);
    }

    function testCancelOnlySeller() public {
        NftMarketplace.Order memory order = _order();
        vm.prank(buyer);
        vm.expectRevert("not seller");
        market.cancelOrder(order);
    }

    function testBadSignatureReverts() public {
        NftMarketplace.Order memory order = _order();
        // Signed by someone other than order.seller.
        bytes memory sig = _sign(0xBADBAD, order);

        vm.prank(buyer);
        vm.expectRevert("bad signature");
        market.fulfillOrder(order, sig);
    }

    function testSellerNoLongerOwnsNftReverts() public {
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        // Seller moves the NFT elsewhere, leaving a stale signature floating.
        vm.prank(seller);
        nft.transferFrom(seller, address(0xDEAD), TOKEN_ID);

        vm.prank(buyer);
        vm.expectRevert("seller not owner");
        market.fulfillOrder(order, sig);
    }

    function testPaymentTokenNotAllowedReverts() public {
        market.setAllowedPaymentToken(address(pay), false);
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        vm.prank(buyer);
        vm.expectRevert("payment token not allowed");
        market.fulfillOrder(order, sig);
    }

    function testTamperedOrderReverts() public {
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        // Buyer tries to fulfil at a lower price than the seller signed.
        order.price = 1 ether;
        vm.prank(buyer);
        vm.expectRevert("bad signature");
        market.fulfillOrder(order, sig);
    }

    function testPausedReverts() public {
        market.pause();
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        vm.prank(buyer);
        vm.expectRevert("Pausable: paused");
        market.fulfillOrder(order, sig);
    }

    function testSetFeeBpsCap() public {
        vm.expectRevert("fee too high");
        market.setFeeBps(1001);
        market.setFeeBps(1000);
        assertEq(market.feeBps(), 1000);
    }

    function testConstructorFeeCap() public {
        vm.expectRevert("fee too high");
        new NftMarketplace(1001, feeCollector);
    }

    function testOnlyOwnerCanSetFee() public {
        vm.prank(buyer);
        vm.expectRevert("Ownable: caller is not the owner");
        market.setFeeBps(100);
    }

    function testZeroFeeNoTransferToCollector() public {
        market.setFeeBps(0);
        NftMarketplace.Order memory order = _order();
        bytes memory sig = _sign(sellerPk, order);

        vm.prank(buyer);
        market.fulfillOrder(order, sig);

        assertEq(pay.balanceOf(seller), PRICE);
        assertEq(pay.balanceOf(feeCollector), 0);
    }
}
