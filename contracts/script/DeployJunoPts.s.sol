// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {JunoPts} from "../src/JunoPts.sol";

/// @notice Deploys JunoPts. Requires PermissionRegistry to already be deployed.
/// @dev Env:
///      NAME         — token name, e.g. "Juno Points"
///      SYMBOL       — token symbol, e.g. "JPTS"
///      REGISTRY     — deployed PermissionRegistry address
///      COMMITTEE    — fraud-recovery role holder (adminTransfer/adminApprove) — a multisig on mainnet
///      ADMIN        — DEFAULT_ADMIN_ROLE holder (grants MINTER_ROLE/TRANSFER_ROUTER_ROLE)
///      PRIVATE_KEY  — deployer key
/// @dev After deploying, ADMIN still has to wire two things up, and neither fails loudly if
///      forgotten — points simply stop moving:
///      1. MINTER_ROLE to whatever issues points.
///      2. For any contract that will CUSTODY points (an escrow holding them until a trade
///         settles): AUTHORIZE_ROLE on PermissionRegistry, so an unregistered holder can pay into
///         it — a transfer needs one Registered side. If that contract also has to move points
///         between two unregistered addresses (releasing escrow to an unregistered merchant), it
///         needs TRANSFER_ROUTER_ROLE on this token instead, which skips the check entirely.
///      RedeemNftSettlement needs neither: it BURNS the points leg (burnFrom), and burns are not
///      gated — only transfers are.
contract DeployJunoPts is Script {
    function run() external returns (JunoPts pts) {
        string memory name = vm.envString("NAME");
        string memory symbol = vm.envString("SYMBOL");
        address registry = vm.envAddress("REGISTRY");
        address committee = vm.envAddress("COMMITTEE");
        address admin = vm.envAddress("ADMIN");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        pts = new JunoPts(name, symbol, registry, committee, admin);
        vm.stopBroadcast();
    }
}
