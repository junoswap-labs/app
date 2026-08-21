// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script} from "forge-std/Script.sol";
import {AirdropEscrow} from "../src/AirdropEscrow.sol";

/// @notice Deploys the Airdrop escrow vault, granting RELAYER_ROLE to the backend relayer
///         service's wallet (see ./server in the repo root) so it can submit claimFor() on
///         behalf of claimants in "creator pays gas" campaigns, and BACKEND_SIGNER_ROLE to the
///         wallet that signs self-pay claim() authorizations (see app/api/airdrop/claim). All
///         three roles are granted directly in the constructor (not via a follow-up grantRole()
///         call) so ADMIN can safely be a multisig distinct from the deployer key — a
///         post-construction grantRole() would revert in that case, since the deployer itself
///         never holds DEFAULT_ADMIN_ROLE.
/// @dev Env:
///      CREATION_FEE_FLAT     — native KUB (wei) charged per createCampaign(); 0 for now
///      FEE_COLLECTOR         — receives the creation fee, once non-zero
///      ADMIN                 — granted DEFAULT_ADMIN_ROLE (fee/pause/role-grant rights)
///      RELAYER_ADDRESS       — granted RELAYER_ROLE; must match ./server's AIRDROP_RELAYER_PRIVATE_KEY
///      BACKEND_SIGNER_ADDRESS — granted BACKEND_SIGNER_ROLE; must match the main app's AIRDROP_SIGNER_PRIVATE_KEY
///      PRIVATE_KEY           — deployer key
contract DeployAirdropEscrow is Script {
    function run() external returns (AirdropEscrow escrow) {
        uint256 creationFeeFlat = vm.envUint("CREATION_FEE_FLAT");
        address feeCollector = vm.envAddress("FEE_COLLECTOR");
        address admin = vm.envAddress("ADMIN");
        address relayerAddress = vm.envAddress("RELAYER_ADDRESS");
        address backendSignerAddress = vm.envAddress("BACKEND_SIGNER_ADDRESS");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        escrow = new AirdropEscrow(creationFeeFlat, feeCollector, admin, relayerAddress, backendSignerAddress);
        vm.stopBroadcast();
    }
}
