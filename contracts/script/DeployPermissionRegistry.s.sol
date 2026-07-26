// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {PermissionRegistry} from "../src/PermissionRegistry.sol";

/// @notice Deploys PermissionRegistry, the on-chain source of truth for Admin/Partner/Authorize
///         roles. Deploy this before JunoPts and RedeemNftSettlement — both take its address.
/// @dev Env:
///      ADMIN        — DEFAULT_ADMIN_ROLE holder (a multisig on mainnet)
///      PRIVATE_KEY  — deployer key
contract DeployPermissionRegistry is Script {
    function run() external returns (PermissionRegistry registry) {
        address admin = vm.envAddress("ADMIN");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        registry = new PermissionRegistry(admin);
        vm.stopBroadcast();
    }
}
