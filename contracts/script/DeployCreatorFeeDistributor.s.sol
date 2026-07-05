// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {CreatorFeeDistributor} from "../src/CreatorFeeDistributor.sol";

/// @notice Deploys CreatorFeeDistributor for the Launchpad Fee-Creator campaign.
/// @dev Env:
///      PAYOUT_TOKEN  — KKUB (kub mainnet 0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5)
///      CLAIM_WINDOW  — seconds a creator has to claim an epoch; set to 3 * epochDuration
///                      (e.g. weekly epochs -> 1814400 = 21 days) so "forfeit after 3 epochs" holds
///      ADMIN         — DEFAULT_ADMIN_ROLE + PUBLISHER_ROLE holder (a multisig on mainnet)
///      PRIVATE_KEY   — deployer key
contract DeployCreatorFeeDistributor is Script {
    function run() external returns (CreatorFeeDistributor dist) {
        address payoutToken = vm.envAddress("PAYOUT_TOKEN");
        uint256 claimWindow = vm.envUint("CLAIM_WINDOW");
        address admin = vm.envAddress("ADMIN");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        dist = new CreatorFeeDistributor(payoutToken, claimWindow, admin);
        vm.stopBroadcast();
    }
}
