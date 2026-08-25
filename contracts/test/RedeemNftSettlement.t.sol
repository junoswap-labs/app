// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {RedeemNftSettlement} from "../src/RedeemNftSettlement.sol";
import {PermissionRegistry} from "../src/PermissionRegistry.sol";
import {JunoPts} from "../src/JunoPts.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC721} from "./mocks/MockERC721.sol";

contract RedeemNftSettlementTest is Test {
    RedeemNftSettlement internal settlement;
    PermissionRegistry internal registry;
    JunoPts internal pts;
    MockERC20 internal cmm; // stand-in for a second payment-leg token (e.g. a meme/community token)
    MockERC721 internal nft;

    address internal admin = address(this);
    address internal committee = address(0xC0FFEE);
    address internal minter = address(0x114E7);
    address internal treasury = address(0x7EEA);

    uint256 internal operatorPk = 0xA11CE;
    address internal operator; // Admin-signed offers use this; also used for Partner-signed tests via a second key

    uint256 internal partnerPk = 0xB0B5;
    address internal partnerOperator;

    address internal buyer = address(0xB4E7);

    uint256 internal constant TOKEN_ID = 7;
    uint256 internal constant PTS_AMOUNT = 900 ether;
    uint256 internal constant CMM_AMOUNT = 500_000 ether;

    function setUp() public {
        operator = vm.addr(operatorPk);
        partnerOperator = vm.addr(partnerPk);

        registry = new PermissionRegistry(admin);
        pts = new JunoPts("Juno Points", "JPTS", address(registry), committee, admin);
        cmm = new MockERC20();
        nft = new MockERC721();
        settlement = new RedeemNftSettlement(address(registry), address(pts), treasury, admin);

        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), operator); // operator redeems as Admin
        registry.grantRole(registry.PARTNER_REDEEM_ROLE(), partnerOperator); // partnerOperator redeems as Partner

        pts.grantRole(pts.MINTER_ROLE(), minter);
        vm.prank(minter);
        pts.mint(buyer, PTS_AMOUNT);

        cmm.mint(buyer, CMM_AMOUNT);

        vm.startPrank(buyer);
        pts.approve(address(settlement), type(uint256).max);
        cmm.approve(address(settlement), type(uint256).max);
        vm.stopPrank();
    }

    function _emptyLeg() internal pure returns (RedeemNftSettlement.PriceLeg memory) {
        return RedeemNftSettlement.PriceLeg({token: address(0), amount: 0});
    }

    function _offer(address op, RedeemNftSettlement.Tier tier)
        internal
        view
        returns (RedeemNftSettlement.RedeemOffer memory offer)
    {
        offer = _offer(op, tier, address(0));
    }

    function _offer(address op, RedeemNftSettlement.Tier tier, address payoutWallet)
        internal
        view
        returns (RedeemNftSettlement.RedeemOffer memory offer)
    {
        RedeemNftSettlement.PriceLeg[3] memory legs = [
            RedeemNftSettlement.PriceLeg({token: address(pts), amount: PTS_AMOUNT}),
            RedeemNftSettlement.PriceLeg({token: address(cmm), amount: CMM_AMOUNT}),
            _emptyLeg()
        ];
        offer = RedeemNftSettlement.RedeemOffer({
            itemId: 1,
            operator: op,
            buyer: buyer,
            nftContract: address(nft),
            tokenId: TOKEN_ID,
            tier: tier,
            payoutWallet: payoutWallet,
            legs: legs,
            nonce: 1,
            expiry: block.timestamp + 1 days
        });
    }

    function _sign(uint256 pk, RedeemNftSettlement.RedeemOffer memory offer) internal view returns (bytes memory) {
        bytes32 digest = settlement.offerDigest(offer);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testConstructorZeroAddressChecks() public {
        vm.expectRevert("zero address");
        new RedeemNftSettlement(address(0), address(pts), treasury, admin);
        vm.expectRevert("zero address");
        new RedeemNftSettlement(address(registry), address(0), treasury, admin);
        vm.expectRevert("zero address");
        new RedeemNftSettlement(address(registry), address(pts), address(0), admin);
        vm.expectRevert("zero address");
        new RedeemNftSettlement(address(registry), address(pts), treasury, address(0));
    }

    function testRedeemOfficialMintHappyPath() public {
        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Official);
        bytes memory sig = _sign(operatorPk, offer);

        settlement.redeem(offer, sig);

        assertEq(nft.ownerOf(TOKEN_ID), buyer, "nft minted to buyer");
        assertEq(pts.balanceOf(buyer), 0, "points burned");
        assertEq(cmm.balanceOf(buyer), 0, "cmm leg pulled from buyer");
        assertEq(cmm.balanceOf(treasury), CMM_AMOUNT, "cmm leg paid to treasury");
        assertEq(pts.balanceOf(treasury), 0, "points are burned, not paid to treasury");
    }

    function testRedeemRegisteredTransferHappyPath() public {
        nft.mint(treasury, TOKEN_ID);
        vm.prank(treasury);
        nft.setApprovalForAll(address(settlement), true);

        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Registered);
        bytes memory sig = _sign(operatorPk, offer);
        settlement.redeem(offer, sig);

        assertEq(nft.ownerOf(TOKEN_ID), buyer, "nft transferred from treasury to buyer");
    }

    /// @notice A Registered item with no payoutWallet set falls back to Official's 100%-to-treasury
    ///         split — same assertions as testRedeemOfficialMintHappyPath, just under Registered tier.
    function testRedeemRegisteredWithoutPayoutWalletFallsBackToTreasury() public {
        nft.mint(treasury, TOKEN_ID);
        vm.prank(treasury);
        nft.setApprovalForAll(address(settlement), true);

        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Registered);
        bytes memory sig = _sign(operatorPk, offer);
        settlement.redeem(offer, sig);

        assertEq(cmm.balanceOf(treasury), CMM_AMOUNT, "no payoutWallet - full amount to treasury");
    }

    function testRedeemRegisteredWithPayoutWalletSplitsPlatformFee() public {
        address partnerWallet = address(0xBEEF);
        nft.mint(treasury, TOKEN_ID);
        vm.prank(treasury);
        nft.setApprovalForAll(address(settlement), true);

        RedeemNftSettlement.RedeemOffer memory offer =
            _offer(operator, RedeemNftSettlement.Tier.Registered, partnerWallet);
        bytes memory sig = _sign(operatorPk, offer);
        settlement.redeem(offer, sig);

        uint256 expectedFee = (CMM_AMOUNT * settlement.PLATFORM_FEE_BPS()) / 10000;
        assertEq(nft.ownerOf(TOKEN_ID), buyer, "nft transferred from treasury to buyer");
        assertEq(cmm.balanceOf(treasury), expectedFee, "10% platform fee to treasury");
        assertEq(cmm.balanceOf(partnerWallet), CMM_AMOUNT - expectedFee, "90% to the listing's payout wallet");
        assertEq(pts.balanceOf(partnerWallet), 0, "PTS leg is always burned, never split to payoutWallet");
    }

    function testRedeemOfficialWithNonZeroPayoutWalletReverts() public {
        RedeemNftSettlement.RedeemOffer memory offer =
            _offer(operator, RedeemNftSettlement.Tier.Official, address(0xBEEF));
        bytes memory sig = _sign(operatorPk, offer);
        vm.expectRevert("payoutWallet only for Registered");
        settlement.redeem(offer, sig);
    }

    function testRedeemPartnerSignedOfferSucceeds() public {
        RedeemNftSettlement.RedeemOffer memory offer = _offer(partnerOperator, RedeemNftSettlement.Tier.Official);
        bytes memory sig = _sign(partnerPk, offer);
        settlement.redeem(offer, sig);
        assertEq(nft.ownerOf(TOKEN_ID), buyer);
    }

    function testRedeemBadSignatureReverts() public {
        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Official);
        bytes memory sig = _sign(partnerPk, offer); // signed by the wrong key
        vm.expectRevert("bad signature");
        settlement.redeem(offer, sig);
    }

    function testRedeemExpiredReverts() public {
        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Official);
        offer.expiry = block.timestamp - 1;
        bytes memory sig = _sign(operatorPk, offer);
        vm.expectRevert("offer expired");
        settlement.redeem(offer, sig);
    }

    function testRedeemAlreadyRedeemedReverts() public {
        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Official);
        bytes memory sig = _sign(operatorPk, offer);
        settlement.redeem(offer, sig);
        vm.expectRevert("offer already redeemed");
        settlement.redeem(offer, sig);
    }

    /// @notice Operator status is checked live, not just at signing time — a Partner whose
    ///         redeem-curator role is revoked after signing can no longer have that offer redeemed.
    function testRedeemRevokedPartnerCannotRedeemAfterRevocation() public {
        RedeemNftSettlement.RedeemOffer memory offer = _offer(partnerOperator, RedeemNftSettlement.Tier.Official);
        bytes memory sig = _sign(partnerPk, offer);

        registry.revokeRole(registry.PARTNER_REDEEM_ROLE(), partnerOperator);

        vm.expectRevert("operator lost redeem-curator rights");
        settlement.redeem(offer, sig);
    }

    function testRedeemUnprivilegedOperatorReverts() public {
        uint256 outsiderPk = 0xDEAD;
        address outsider = vm.addr(outsiderPk);
        RedeemNftSettlement.RedeemOffer memory offer = _offer(outsider, RedeemNftSettlement.Tier.Official);
        bytes memory sig = _sign(outsiderPk, offer);
        vm.expectRevert("operator lost redeem-curator rights");
        settlement.redeem(offer, sig);
    }

    function testRedeemSkipsUnusedLegSlots() public {
        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Official);
        // Only the JunoPts leg is used; cmm and the third slot are zeroed out.
        offer.legs[1] = _emptyLeg();
        bytes memory sig = _sign(operatorPk, offer);
        settlement.redeem(offer, sig);

        assertEq(pts.balanceOf(buyer), 0, "points leg still charged");
        assertEq(cmm.balanceOf(buyer), CMM_AMOUNT, "unused cmm leg untouched");
    }

    function testRedeemPausedReverts() public {
        settlement.pause();
        RedeemNftSettlement.RedeemOffer memory offer = _offer(operator, RedeemNftSettlement.Tier.Official);
        bytes memory sig = _sign(operatorPk, offer);
        vm.expectRevert("Pausable: paused");
        settlement.redeem(offer, sig);
    }

    function testSetTreasuryOnlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert("Ownable: caller is not the owner");
        settlement.setTreasury(address(0xBEEF));
    }

    function testSetTreasuryUpdatesDestination() public {
        address newTreasury = address(0xBEEF);
        settlement.setTreasury(newTreasury);
        assertEq(settlement.treasury(), newTreasury);
    }
}
