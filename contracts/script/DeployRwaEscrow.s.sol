// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {RwaEscrow} from "../src/RwaEscrow.sol";

/// @notice Deploys the RWA escrow vault. The three deadlines are constructor params (not hardcoded
///         constants) specifically so testnet can use minutes for fast iteration while mainnet uses
///         the real day-scale values — same bytecode either way.
/// @dev Env (all in seconds):
///      FEE_BPS                — platform fee in basis points, capped at MAX_FEE_BPS (1000 = 10%)
///      FEE_COLLECTOR          — receives the fee cut of every completed/auto-released order
///      SHIP_DEADLINE           — mainnet: 604800 (7 days)  · testnet suggestion: 420 (7 minutes)
///      DISPUTE_GRACE           — mainnet: 259200 (3 days)  · testnet suggestion: 180 (3 minutes)
///      AUTO_RELEASE_DEADLINE   — mainnet: 864000 (10 days) · testnet suggestion: 600 (10 minutes)
///      PRIVATE_KEY             — deployer key
///      The constructor itself enforces DISPUTE_GRACE < AUTO_RELEASE_DEADLINE — get this wrong
///      and the deploy tx reverts rather than producing a misconfigured instance.
contract DeployRwaEscrow is Script {
    function run() external returns (RwaEscrow escrow) {
        uint256 feeBps = vm.envUint("FEE_BPS");
        address feeCollector = vm.envAddress("FEE_COLLECTOR");
        uint256 shipDeadline = vm.envUint("SHIP_DEADLINE");
        uint256 disputeGrace = vm.envUint("DISPUTE_GRACE");
        uint256 autoReleaseDeadline = vm.envUint("AUTO_RELEASE_DEADLINE");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        escrow = new RwaEscrow(feeBps, feeCollector, shipDeadline, disputeGrace, autoReleaseDeadline);
        vm.stopBroadcast();
    }
}
