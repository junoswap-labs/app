// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {PermissionRegistry} from "../src/PermissionRegistry.sol";

contract PermissionRegistryTest is Test {
    PermissionRegistry internal registry;

    address internal partner = address(0x9A62E7);
    address internal seller = address(0x5E11E2);
    address internal outsider = address(0xDEAD);

    function setUp() public {
        // admin == this test contract, mirroring CreatorFeeDistributor.t.sol's convention.
        registry = new PermissionRegistry(address(this));
    }

    function testConstructorGrantsAdmin() public view {
        assertTrue(registry.isAdmin(address(this)));
    }

    function testConstructorZeroAdminReverts() public {
        vm.expectRevert("zero admin");
        new PermissionRegistry(address(0));
    }

    function testGrantAndRevokePartnerMarketplace() public {
        registry.grantRole(registry.PARTNER_MARKETPLACE_ROLE(), partner);
        assertTrue(registry.isPartnerMarketplace(partner));

        registry.revokeRole(registry.PARTNER_MARKETPLACE_ROLE(), partner);
        assertFalse(registry.isPartnerMarketplace(partner));
    }

    function testGrantAndRevokePartnerRedeem() public {
        registry.grantRole(registry.PARTNER_REDEEM_ROLE(), partner);
        assertTrue(registry.isPartnerRedeem(partner));

        registry.revokeRole(registry.PARTNER_REDEEM_ROLE(), partner);
        assertFalse(registry.isPartnerRedeem(partner));
    }

    /// @notice A Partner approved for Marketplace is NOT automatically approved for Redeem —
    ///         these are two independent applications/roles per the product requirement.
    function testPartnerMarketplaceAndRedeemAreIndependent() public {
        registry.grantRole(registry.PARTNER_MARKETPLACE_ROLE(), partner);

        assertTrue(registry.isPartnerMarketplace(partner));
        assertFalse(registry.isPartnerRedeem(partner));

        registry.grantRole(registry.PARTNER_REDEEM_ROLE(), partner);
        assertTrue(registry.isPartnerMarketplace(partner));
        assertTrue(registry.isPartnerRedeem(partner));
    }

    function testGrantAndRevokeAuthorize() public {
        registry.grantRole(registry.AUTHORIZE_ROLE(), seller);
        assertTrue(registry.isAuthorized(seller));

        registry.revokeRole(registry.AUTHORIZE_ROLE(), seller);
        assertFalse(registry.isAuthorized(seller));
    }

    function testUngrantedAccountsAreNotAuthorized() public view {
        assertFalse(registry.isPartnerMarketplace(outsider));
        assertFalse(registry.isPartnerRedeem(outsider));
        assertFalse(registry.isAuthorized(outsider));
        assertFalse(registry.isAdmin(outsider));
    }

    function testNonAdminCannotGrantRoles() public {
        // Resolve the role hash before pranking — vm.prank only covers the *next* external call,
        // and AUTHORIZE_ROLE() is itself an external view call that would consume it otherwise.
        bytes32 role = registry.AUTHORIZE_ROLE();
        vm.prank(outsider);
        vm.expectRevert();
        registry.grantRole(role, seller);
    }

    function testNonAdminCannotRevokeRoles() public {
        bytes32 role = registry.AUTHORIZE_ROLE();
        registry.grantRole(role, seller);
        vm.prank(outsider);
        vm.expectRevert();
        registry.revokeRole(role, seller);
    }

    function testAccountCanRenounceOwnRole() public {
        bytes32 role = registry.AUTHORIZE_ROLE();
        registry.grantRole(role, seller);
        vm.prank(seller);
        registry.renounceRole(role, seller);
        assertFalse(registry.isAuthorized(seller));
    }

    function testMultipleAdminsCanBeGranted() public {
        address secondAdmin = address(0xA33477);
        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), secondAdmin);
        assertTrue(registry.isAdmin(secondAdmin));
        assertTrue(registry.isAdmin(address(this)), "original admin unaffected");
    }
}
