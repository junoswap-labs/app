import type { Address } from 'viem'
import { nftMarketplaceEventsAbi } from '@/lib/abis/nft-marketplace'
import { rwaEscrowEventsAbi } from '@/lib/abis/rwa-escrow'

export interface SyncTarget {
    contract: 'nft_marketplace' | 'rwa_escrow'
    address: Address
    abi: typeof nftMarketplaceEventsAbi | typeof rwaEscrowEventsAbi
    /** First block to scan from if sync_state has no row yet — avoids a full-chain rescan. */
    deployBlock: bigint
}

/** Contracts not yet deployed (no NEXT_PUBLIC_*_ADDRESS set) are skipped, not errored on. */
export function getSyncTargets(): SyncTarget[] {
    const targets: SyncTarget[] = []

    const nftAddress = process.env.NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS
    if (nftAddress) {
        targets.push({
            contract: 'nft_marketplace',
            address: nftAddress as Address,
            abi: nftMarketplaceEventsAbi,
            deployBlock: BigInt(process.env.NFT_MARKETPLACE_DEPLOY_BLOCK ?? '0'),
        })
    }

    const rwaAddress = process.env.NEXT_PUBLIC_RWA_ESCROW_ADDRESS
    if (rwaAddress) {
        targets.push({
            contract: 'rwa_escrow',
            address: rwaAddress as Address,
            abi: rwaEscrowEventsAbi,
            deployBlock: BigInt(process.env.RWA_ESCROW_DEPLOY_BLOCK ?? '0'),
        })
    }

    return targets
}
