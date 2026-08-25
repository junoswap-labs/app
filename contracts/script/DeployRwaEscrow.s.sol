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
///      EXTENSION_PERIOD        — mainnet: 604800 (7 days)  · testnet suggestion: 420 (7 minutes)
///                                one-time buyer-triggered grace period on top of
///                                AUTO_RELEASE_DEADLINE, see extendAutoRelease() on the contract
///      PRIVATE_KEY             — deployer key
///      TOKEN_MANAGER            — optional address to grant TOKEN_MANAGER_ROLE to post-deploy.
///                                 Pass the Redeem operator wallet when deploying the Redeem
///                                 instance so item creation can auto-allow a payment token
///                                 server-side; leave unset for the Marketplace instance, where
///                                 allow-listing stays a manual admin decision (see RwaEscrow.sol's
///                                 header comment on TOKEN_MANAGER_ROLE).
///      The constructor itself enforces DISPUTE_GRACE < AUTO_RELEASE_DEADLINE — get this wrong
///      and the deploy tx reverts rather than producing a misconfigured instance.
contract DeployRwaEscrow is Script {
    function run() external returns (RwaEscrow escrow) {
        uint256 feeBps = vm.envUint("FEE_BPS");
        address feeCollector = vm.envAddress("FEE_COLLECTOR");
        uint256 shipDeadline = vm.envUint("SHIP_DEADLINE");
        uint256 disputeGrace = vm.envUint("DISPUTE_GRACE");
        uint256 autoReleaseDeadline = vm.envUint("AUTO_RELEASE_DEADLINE");
        uint256 extensionPeriod = vm.envUint("EXTENSION_PERIOD");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address tokenManager = vm.envOr("TOKEN_MANAGER", address(0));

        vm.startBroadcast(pk);
        escrow = new RwaEscrow(feeBps, feeCollector, shipDeadline, disputeGrace, autoReleaseDeadline, extensionPeriod);
        if (tokenManager != address(0)) {
            escrow.grantRole(escrow.TOKEN_MANAGER_ROLE(), tokenManager);
        }
        vm.stopBroadcast();
    }
}
