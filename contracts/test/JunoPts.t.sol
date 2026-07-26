// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {JunoPts} from "../src/JunoPts.sol";
import {PermissionRegistry} from "../src/PermissionRegistry.sol";

contract JunoPtsTest is Test {
    JunoPts internal pts;
    PermissionRegistry internal registry;

    address internal admin = address(this);
    address internal committee = address(0xC0771EE);
    address internal minter = address(0x114E7); // minter
    address internal router = address(0x20017E);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal treasury = address(0x7EEA);

    function setUp() public {
        registry = new PermissionRegistry(admin);
        pts = new JunoPts("Juno Points", "JPTS", address(registry), committee, admin);
        pts.grantRole(pts.MINTER_ROLE(), minter);
        pts.grantRole(pts.TRANSFER_ROUTER_ROLE(), router);

        registry.grantRole(registry.AUTHORIZE_ROLE(), alice);
        registry.grantRole(registry.AUTHORIZE_ROLE(), bob);
        // treasury is intentionally left unregistered/unauthorized for several tests below.
    }

    function _mint(address to, uint256 amount) internal {
        vm.prank(minter);
        pts.mint(to, amount);
    }

    // ---- constructor ----

    function testConstructorZeroRegistryReverts() public {
        vm.expectRevert("zero address");
        new JunoPts("Juno Points", "JPTS", address(0), committee, admin);
    }

    function testConstructorZeroCommitteeReverts() public {
        vm.expectRevert("zero address");
        new JunoPts("Juno Points", "JPTS", address(registry), address(0), admin);
    }

    function testConstructorZeroAdminReverts() public {
        vm.expectRevert("zero address");
        new JunoPts("Juno Points", "JPTS", address(registry), committee, address(0));
    }

    // ---- minting ----

    function testOnlyMinterCanMint() public {
        vm.expectRevert();
        pts.mint(alice, 100);
    }

    function testMintCreditsBalanceAndPeriod() public {
        _mint(alice, 100);
        assertEq(pts.balanceOf(alice), 100);
        assertEq(pts.balanceOfPeriod(alice, 0), 100);
    }

    function testMintCustomPeriodFutureReverts() public {
        vm.prank(minter);
        vm.expectRevert("future period");
        pts.mintCustomPeriod(alice, 1, 100);
    }

    function testMintCustomPeriodPastAllowed() public {
        vm.prank(admin);
        pts.advancePeriod(0);
        vm.prank(minter);
        pts.mintCustomPeriod(alice, 0, 50);
        assertEq(pts.balanceOfPeriod(alice, 0), 50);
        assertEq(pts.balanceOf(alice), 50);
    }

    // ---- ordinary transfer gating ----

    function testTransferBetweenAuthorizedSucceeds() public {
        _mint(alice, 100);
        vm.prank(alice);
        pts.transfer(bob, 40);
        assertEq(pts.balanceOf(alice), 60);
        assertEq(pts.balanceOf(bob), 40);
    }

    function testTransferFromUnauthorizedSenderReverts() public {
        registry.revokeRole(registry.AUTHORIZE_ROLE(), alice);
        _mint(alice, 100); // minting doesn't require sender-authorization (from == address(0))
        vm.prank(alice);
        vm.expectRevert("both parties must be authorized");
        pts.transfer(bob, 40);
    }

    function testTransferToUnauthorizedRecipientReverts() public {
        _mint(alice, 100);
        vm.prank(alice);
        vm.expectRevert("both parties must be authorized");
        pts.transfer(treasury, 40); // treasury never granted AUTHORIZE_ROLE
    }

    function testTransferFromRespectsAuthorizationGating() public {
        _mint(alice, 100);
        vm.prank(alice);
        pts.approve(bob, 40);
        vm.prank(bob);
        vm.expectRevert("both parties must be authorized");
        pts.transferFrom(alice, treasury, 40);
    }

    function testTransferRouterBypassesRecipientCheckOnTransferFrom() public {
        _mint(alice, 100);
        vm.prank(alice);
        pts.approve(router, 40);
        vm.prank(router);
        pts.transferFrom(alice, treasury, 40); // treasury unregistered, but router only needs sender authorized
        assertEq(pts.balanceOf(treasury), 40);
    }

    function testTransferRouterStillRequiresSenderAuthorized() public {
        registry.revokeRole(registry.AUTHORIZE_ROLE(), alice);
        _mint(alice, 100);
        vm.prank(alice);
        pts.approve(router, 40);
        vm.prank(router);
        vm.expectRevert("sender must be authorized");
        pts.transferFrom(alice, treasury, 40);
    }

    // ---- internalTransfer / externalTransfer (KAP-22 parity) ----

    function testInternalTransferRequiresBothAuthorized() public {
        _mint(alice, 100);
        vm.prank(router);
        vm.expectRevert("both parties must be authorized");
        pts.internalTransfer(alice, treasury, 40);
    }

    function testInternalTransferSucceedsWhenBothAuthorized() public {
        _mint(alice, 100);
        vm.prank(router);
        pts.internalTransfer(alice, bob, 40); // no allowance needed — router-forced move
        assertEq(pts.balanceOf(bob), 40);
    }

    function testExternalTransferOnlyRequiresSenderAuthorized() public {
        _mint(alice, 100);
        vm.prank(router);
        pts.externalTransfer(alice, treasury, 40);
        assertEq(pts.balanceOf(treasury), 40);
    }

    function testInternalTransferOnlyRouterRole() public {
        _mint(alice, 100);
        vm.expectRevert();
        pts.internalTransfer(alice, bob, 40);
    }

    // ---- burn ----

    function testBurnReducesBalanceAndPeriod() public {
        _mint(alice, 100);
        vm.prank(alice);
        pts.burn(40);
        assertEq(pts.balanceOf(alice), 60);
        assertEq(pts.balanceOfPeriod(alice, 0), 60);
    }

    function testBurnFromRequiresAllowance() public {
        _mint(alice, 100);
        vm.expectRevert();
        pts.burnFrom(alice, 40);
    }

    function testBurnFromWithAllowance() public {
        _mint(alice, 100);
        vm.prank(alice);
        pts.approve(address(this), 40);
        pts.burnFrom(alice, 40);
        assertEq(pts.balanceOf(alice), 60);
    }

    /// @notice Ordinary transfers don't touch the period ledger (see contract header comment), so
    ///         it can go stale relative to real balance — but OZ's own `_burn` balance check is
    ///         still authoritative, so this can never allow burning more than the account truly
    ///         holds, even though the period-ledger pre-check alone would have let it through.
    function testStalePeriodLedgerCannotOverBurn() public {
        _mint(alice, 100);
        vm.prank(alice);
        pts.transfer(bob, 60); // real balance now 40; _periodBalance[alice][0] is still 100
        assertEq(pts.balanceOfPeriod(alice, 0), 100, "period ledger not updated by ordinary transfer");

        vm.prank(alice);
        vm.expectRevert("ERC20: burn amount exceeds balance");
        pts.burn(70); // passes the stale period check (100>=70) but OZ's real balance check catches it
    }

    // ---- pause ----

    function testPauseBlocksOrdinaryTransfer() public {
        _mint(alice, 100);
        pts.pause();
        vm.prank(alice);
        vm.expectRevert("Pausable: paused");
        pts.transfer(bob, 10);
    }

    function testPauseDoesNotBlockBurn() public {
        _mint(alice, 100);
        pts.pause();
        vm.prank(alice);
        pts.burn(10); // burn is an escape hatch, not gated by pause — mirrors RwaEscrow.resolveDispute's philosophy
        assertEq(pts.balanceOf(alice), 90);
    }

    function testOnlyAdminCanPause() public {
        vm.prank(alice);
        vm.expectRevert();
        pts.pause();
    }

    // ---- committee fraud recovery ----

    function testAdminTransferBypassesAuthorization() public {
        registry.revokeRole(registry.AUTHORIZE_ROLE(), alice);
        _mint(alice, 100);
        vm.prank(committee);
        pts.adminTransfer(alice, treasury, 100);
        assertEq(pts.balanceOf(treasury), 100);
    }

    function testAdminTransferBypassesPause() public {
        _mint(alice, 100);
        pts.pause();
        vm.prank(committee);
        pts.adminTransfer(alice, treasury, 100); // fraud recovery must work even during an emergency pause
        assertEq(pts.balanceOf(treasury), 100);
    }

    function testAdminTransferOnlyCommittee() public {
        _mint(alice, 100);
        vm.expectRevert();
        pts.adminTransfer(alice, treasury, 100);
    }

    function testAdminApprove() public {
        _mint(alice, 100);
        vm.prank(committee);
        pts.adminApprove(alice, bob, 50);
        assertEq(pts.allowance(alice, bob), 50);
    }

    // ---- periods ----

    function testAdvancePeriodMintsIntoNewPeriod() public {
        _mint(alice, 50); // period 0
        pts.advancePeriod(30 days);
        assertEq(pts.currentIndex(), 1);

        vm.prank(minter);
        pts.mint(alice, 20); // now credits period 1
        assertEq(pts.balanceOfPeriod(alice, 0), 50);
        assertEq(pts.balanceOfPeriod(alice, 1), 20);
        assertEq(pts.balanceOf(alice), 70);
    }
}
