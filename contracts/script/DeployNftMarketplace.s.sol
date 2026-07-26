// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {NftMarketplace} from "../src/NftMarketplace.sol";

/// @notice Deploys the gasless-listing NFT marketplace.
/// @dev Env:
///      FEE_BPS        — platform fee in basis points, capped at MAX_FEE_BPS (1000 = 10%)
///      FEE_COLLECTOR  — receives the fee cut of every fulfilled order
///      PRIVATE_KEY    — deployer key
contract DeployNftMarketplace is Script {
    function run() external returns (NftMarketplace market) {
        uint256 feeBps = vm.envUint("FEE_BPS");
        address feeCollector = vm.envAddress("FEE_COLLECTOR");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        market = new NftMarketplace(feeBps, feeCollector);
        vm.stopBroadcast();
    }
}
