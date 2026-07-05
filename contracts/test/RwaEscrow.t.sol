// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {RwaEscrow} from "../src/RwaEscrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract RwaEscrowTest is Test {
    RwaEscrow internal escrow;
    MockERC20 internal pay;

    address internal seller = address(0x5E11E2);
    address internal buyer = address(0xB0B);
    address internal arbitrator = address(0xA287);
    address internal feeCollector = address(0xFEE);

    uint256 internal constant FEE_BPS = 250; // 2.5%
    uint256 internal constant AMOUNT = 100 ether;
    bytes32 internal constant LISTING = keccak256("listing-1");

    function setUp() public {
        escrow = new RwaEscrow(FEE_BPS, feeCollector);
        pay = new MockERC20();
        escrow.setAllowedPaymentToken(address(pay), true);
        escrow.grantRole(escrow.ARBITRATOR_ROLE(), arbitrator);

        pay.mint(buyer, 1_000 ether);
        vm.prank(buyer);
        pay.approve(address(escrow), type(uint256).max);
    }

    function _fund() internal {
        vm.prank(buyer);
        escrow.fund(LISTING, seller, address(pay), AMOUNT);
    }

    function _status(bytes32 id) internal view returns (RwaEscrow.Status) {
        (,,,, RwaEscrow.Status status,,) = escrow.orders(id);
        return status;
    }

    function testFundHappyPath() public {
        _fund();
        assertEq(uint256(_status(LISTING)), uint256(RwaEscrow.Status.Funded));
        assertEq(pay.balanceOf(address(escrow)), AMOUNT, "vault holds funds");
        assertEq(pay.balanceOf(buyer), 1_000 ether - AMOUNT);
    }

    function testFundAlreadyFundedReverts() public {
        _fund();
        vm.prank(buyer);
        vm.expectRevert("already funded");
        escrow.fund(LISTING, seller, address(pay), AMOUNT);
    }

    function testFundTokenNotAllowedReverts() public {
        MockERC20 other = new MockERC20();
        other.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        other.approve(address(escrow), AMOUNT);
        vm.expectRevert("payment token not allowed");
        escrow.fund(LISTING, seller, address(other), AMOUNT);
        vm.stopPrank();
    }

    function testFundSelfTradeReverts() public {
        vm.prank(buyer);
        vm.expectRevert("self trade");
        escrow.fund(LISTING, buyer, address(pay), AMOUNT);
    }

    function testHappyPathToCompleted() public {
        _fund();
        vm.prank(seller);
        escrow.markShipped(LISTING);
        assertEq(uint256(_status(LISTING)), uint256(RwaEscrow.Status.Shipped));

        vm.prank(buyer);
        escrow.confirmReceived(LISTING);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        assertEq(uint256(_status(LISTING)), uint256(RwaEscrow.Status.Completed));
        assertEq(pay.balanceOf(seller), AMOUNT - fee, "seller paid");
        assertEq(pay.balanceOf(feeCollector), fee, "fee paid");
        assertEq(pay.balanceOf(address(escrow)), 0, "vault drained");
    }

    function testMarkShippedOnlySeller() public {
        _fund();
        vm.prank(buyer);
        vm.expectRevert("not seller");
        escrow.markShipped(LISTING);
    }

    function testMarkShippedRequiresFunded() public {
        // Status.None -> markShipped must revert.
        vm.prank(seller);
        vm.expectRevert("not seller"); // seller==0 check path: msg.sender != stored(zero) seller
        escrow.markShipped(LISTING);
    }

    function testConfirmReceivedRequiresShipped() public {
        _fund();
        vm.prank(buyer);
        vm.expectRevert("not shipped");
        escrow.confirmReceived(LISTING);
    }

    function testConfirmReceivedOnlyBuyer() public {
        _fund();
        vm.prank(seller);
        escrow.markShipped(LISTING);
        vm.prank(seller);
        vm.expectRevert("not buyer");
        escrow.confirmReceived(LISTING);
    }

    function testClaimRefundBeforeDeadlineReverts() public {
        _fund();
        // Exactly at the boundary it is still not claimable (strict >).
        vm.warp(block.timestamp + escrow.SHIP_DEADLINE());
        vm.prank(buyer);
        vm.expectRevert("ship deadline not passed");
        escrow.claimRefund(LISTING);
    }

    function testClaimRefundAfterDeadline() public {
        _fund();
        vm.warp(block.timestamp + escrow.SHIP_DEADLINE() + 1);
        vm.prank(buyer);
        escrow.claimRefund(LISTING);

        assertEq(uint256(_status(LISTING)), uint256(RwaEscrow.Status.Refunded));
        assertEq(pay.balanceOf(buyer), 1_000 ether, "full refund, no fee");
        assertEq(pay.balanceOf(address(escrow)), 0);
    }

    function testClaimRefundOnlyBuyer() public {
        _fund();
        vm.warp(block.timestamp + escrow.SHIP_DEADLINE() + 1);
        vm.prank(seller);
        vm.expectRevert("not buyer");
        escrow.claimRefund(LISTING);
    }

    function testClaimRefundAfterShippedReverts() public {
        _fund();
        vm.prank(seller);
        escrow.markShipped(LISTING);
        vm.warp(block.timestamp + escrow.SHIP_DEADLINE() + 1);
        vm.prank(buyer);
        vm.expectRevert("not funded");
        escrow.claimRefund(LISTING);
    }

    function testOpenDisputeBeforeGraceReverts() public {
        _fund();
        vm.prank(seller);
        escrow.markShipped(LISTING);
        vm.warp(block.timestamp + escrow.DISPUTE_GRACE());
        vm.prank(buyer);
        vm.expectRevert("dispute grace not passed");
        escrow.openDispute(LISTING);
    }

    function testOpenDisputeAfterGrace() public {
        _fund();
        vm.prank(seller);
        escrow.markShipped(LISTING);
        vm.warp(block.timestamp + escrow.DISPUTE_GRACE() + 1);
        vm.prank(buyer);
        escrow.openDispute(LISTING);
        assertEq(uint256(_status(LISTING)), uint256(RwaEscrow.Status.Disputed));
    }

    function testOpenDisputeNotPartyReverts() public {
        _fund();
        vm.prank(seller);
        escrow.markShipped(LISTING);
        vm.warp(block.timestamp + escrow.DISPUTE_GRACE() + 1);
        vm.prank(address(0xDEAD));
        vm.expectRevert("not party");
        escrow.openDispute(LISTING);
    }

    function _toDisputed() internal {
        _fund();
        vm.prank(seller);
        escrow.markShipped(LISTING);
        vm.warp(block.timestamp + escrow.DISPUTE_GRACE() + 1);
        vm.prank(buyer);
        escrow.openDispute(LISTING);
    }

    function testResolveDisputeReleaseToSeller() public {
        _toDisputed();
        vm.prank(arbitrator);
        escrow.resolveDispute(LISTING, true);

        uint256 fee = (AMOUNT * FEE_BPS) / 10000;
        assertEq(uint256(_status(LISTING)), uint256(RwaEscrow.Status.ResolvedSeller));
        assertEq(pay.balanceOf(seller), AMOUNT - fee);
        assertEq(pay.balanceOf(feeCollector), fee);
    }

    function testResolveDisputeRefundBuyer() public {
        _toDisputed();
        vm.prank(arbitrator);
        escrow.resolveDispute(LISTING, false);

        assertEq(uint256(_status(LISTING)), uint256(RwaEscrow.Status.ResolvedBuyer));
        assertEq(pay.balanceOf(buyer), 1_000 ether, "full refund");
        assertEq(pay.balanceOf(feeCollector), 0);
    }

    function testResolveDisputeOnlyArbitrator() public {
        _toDisputed();
        // Non-arbitrator (even the contract admin) cannot resolve.
        vm.expectRevert();
        escrow.resolveDispute(LISTING, true);
    }

    function testResolveRequiresDisputed() public {
        _fund();
        vm.prank(arbitrator);
        vm.expectRevert("not disputed");
        escrow.resolveDispute(LISTING, true);
    }

    function testPausedFundReverts() public {
        escrow.pause();
        vm.prank(buyer);
        vm.expectRevert("Pausable: paused");
        escrow.fund(LISTING, seller, address(pay), AMOUNT);
    }

    function testSetFeeBpsCap() public {
        vm.expectRevert("fee too high");
        escrow.setFeeBps(1001);
    }

    function testOnlyAdminCanSetFee() public {
        vm.prank(buyer);
        vm.expectRevert();
        escrow.setFeeBps(100);
    }

    function testFeeRoundsDownOnSmallAmount() public {
        // amount * 250 / 10000 with amount = 3 wei rounds to 0 fee; seller gets everything.
        bytes32 id = keccak256("tiny");
        vm.prank(buyer);
        escrow.fund(id, seller, address(pay), 3);
        vm.prank(seller);
        escrow.markShipped(id);
        vm.prank(buyer);
        escrow.confirmReceived(id);
        assertEq(pay.balanceOf(feeCollector), 0);
        assertEq(pay.balanceOf(seller), 3);
    }
}
