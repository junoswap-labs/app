// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title PermissionRegistry — single on-chain source of truth for Admin/Partner/Authorize roles
/// @notice Every role grant/revoke is a real on-chain tx from an existing admin — there is no
///         DB-backed role anywhere in this system (see supabase/migrations/0001_base_schema.sql's
///         header comment). Off-chain "application" submissions (KYC forms, partner pitches) are
///         still reviewed off-chain for their payload, but the actual grant of authority happens
///         here, not in a database status column.
/// @dev DEFAULT_ADMIN_ROLE is the Admin — it administers every other role below (AccessControl's
///      default), matching the convention already used for ARBITRATOR_ROLE in RwaEscrow.sol
///      (a distinct role rather than a second "admin" concept). Should be held by a multisig.
contract PermissionRegistry is AccessControl {
    /// @notice May register new NFT collections/projects and list RWA items without the
    ///         one-time AUTHORIZE_ROLE vetting an individual seller needs (see contracts/'s
    ///         RwaEscrow — Partner accounts are pre-vetted business/brand accounts).
    bytes32 public constant PARTNER_MARKETPLACE_ROLE = keccak256("PARTNER_MARKETPLACE_ROLE");

    /// @notice May create Redeem catalog items. Independent from PARTNER_MARKETPLACE_ROLE by
    ///         design — a Partner can hold one without the other, per two separate application
    ///         flows (see docs/Marketplace_Redeem_Feature.md).
    bytes32 public constant PARTNER_REDEEM_ROLE = keccak256("PARTNER_REDEEM_ROLE");

    /// @notice One-time admin-approved individual seller — required to list an RWA item
    ///         (contracts/RwaEscrow.sol's fund() itself doesn't check this; it's enforced where
    ///         a listing enters the product/discovery layer, same reasoning as NftMarketplace.sol
    ///         not knowing about the collection registry).
    bytes32 public constant AUTHORIZE_ROLE = keccak256("AUTHORIZE_ROLE");

    constructor(address admin) {
        require(admin != address(0), "zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function isPartnerMarketplace(address account) external view returns (bool) {
        return hasRole(PARTNER_MARKETPLACE_ROLE, account);
    }

    function isPartnerRedeem(address account) external view returns (bool) {
        return hasRole(PARTNER_REDEEM_ROLE, account);
    }

    function isAuthorized(address account) external view returns (bool) {
        return hasRole(AUTHORIZE_ROLE, account);
    }
}
