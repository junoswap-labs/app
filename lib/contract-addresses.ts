import directory from '@/config/contracts.json'
import { getContractAddresses, type ContractAddressBag } from '@/config/contract-addresses'

/**
 * Labels/notes live in config/contracts.json; the addresses themselves live in
 * config/contract-addresses.ts. Adding a contract means adding it in both places; a missing entry
 * here shows as "Not deployed".
 */
function addressByEnv(addresses: ContractAddressBag): Record<string, string | undefined> {
    return {
        NEXT_PUBLIC_PERMISSION_REGISTRY_ADDRESS: addresses.permissionRegistry,
        NEXT_PUBLIC_JUNO_PTS_ADDRESS: addresses.junoPts,
        NEXT_PUBLIC_AIRDROP_ESCROW_ADDRESS: addresses.airdropEscrow,
        NEXT_PUBLIC_REDEEM_NFT_SETTLEMENT_ADDRESS: addresses.redeemNftSettlement,
        NEXT_PUBLIC_REDEEM_RWA_ESCROW_ADDRESS: addresses.redeemRwaEscrow,
        NEXT_PUBLIC_RWA_ESCROW_ADDRESS: addresses.rwaEscrow,
        NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS: addresses.nftMarketplace,
        NEXT_PUBLIC_AIRDROP_RELAYER_ADDRESS: addresses.airdropRelayer,
        NEXT_PUBLIC_AIRDROP_SIGNER_ADDRESS: addresses.airdropSigner,
        NEXT_PUBLIC_REDEEM_OPERATOR_ADDRESS: addresses.redeemOperator,
        NEXT_PUBLIC_REDEEM_OFFICIAL_TREASURY_ADDRESS: addresses.redeemOfficialTreasury,
    }
}

export interface DirectoryEntry {
    label: string
    env: string
    note: string
    address?: string
}

function resolve(entries: { label: string; env: string; note: string }[], addressByEnvMap: Record<string, string | undefined>): DirectoryEntry[] {
    return entries.map((entry) => ({ ...entry, address: addressByEnvMap[entry.env] || undefined }))
}

/** Built per chainId — pass the wallet's connected chain (useChainId()), not the deployment's
 *  NEXT_PUBLIC_CHAIN_ID, so the directory reflects whatever network the admin is actually on. */
export function getContractDirectory(chainId: number) {
    const addressByEnvMap = addressByEnv(getContractAddresses(chainId))
    return {
        contractDirectory: resolve(directory.contracts, addressByEnvMap),
        walletDirectory: resolve(directory.wallets, addressByEnvMap),
    }
}
