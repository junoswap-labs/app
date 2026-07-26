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
