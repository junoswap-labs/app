// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {RedeemNftSettlement} from "../src/RedeemNftSettlement.sol";

/// @notice Deploys RedeemNftSettlement. Requires PermissionRegistry and JunoPts to already be
///         deployed. Merch redemption doesn't need this contract at all — it reuses RwaEscrow
///         directly (see docs/Marketplace_Redeem_Feature.md).
/// @dev Env:
///      REGISTRY     — deployed PermissionRegistry address
///      JUNO_PTS     — deployed JunoPts address
///      TREASURY     — receives every non-JunoPts price leg (JunoPts itself is burned, not paid out)
///      OWNER        — Ownable2Step owner (pause/setTreasury) — a multisig on mainnet
///      PRIVATE_KEY  — deployer key
contract DeployRedeemNftSettlement is Script {
    function run() external returns (RedeemNftSettlement settlement) {
        address registry = vm.envAddress("REGISTRY");
        address junoPts = vm.envAddress("JUNO_PTS");
        address treasury = vm.envAddress("TREASURY");
        address owner = vm.envAddress("OWNER");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        settlement = new RedeemNftSettlement(registry, junoPts, treasury, owner);
        vm.stopBroadcast();
    }
}
