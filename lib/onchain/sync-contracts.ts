import type { Address } from 'viem'
import { getContractAddresses, getDeployBlocks } from '@/config/contract-addresses'
import { nftMarketplaceEventsAbi } from '@/lib/abis/nft-marketplace'
import { rwaEscrowEventsAbi } from '@/lib/abis/rwa-escrow'
import { redeemNftSettlementEventsAbi } from '@/lib/abis/redeem-nft-settlement'
import { airdropEscrowEventsAbi } from '@/lib/abis/airdrop'
import {
    marketplaceEventHandlers,
    redeemNftEventHandlers,
    redeemRwaEventHandlers,
    airdropEventHandlers,
} from '@/services/sync/handlers'
import type { SyncEventHandler } from '@/services/sync/handlers'

export interface SyncTarget {
    contract: 'nft_marketplace' | 'rwa_escrow' | 'redeem_nft_settlement' | 'redeem_rwa_escrow' | 'airdrop_escrow'
    chainId: number
    address: Address
    abi:
        | typeof nftMarketplaceEventsAbi
        | typeof rwaEscrowEventsAbi
        | typeof redeemNftSettlementEventsAbi
        | typeof airdropEscrowEventsAbi
    /** Keyed by event name, scoped to this one deployed contract — see handlers.ts's header comment
     *  on why this can't be a single global eventName -> handler map: the Redeem-dedicated
     *  RwaEscrow deployment emits the exact same event names as the Marketplace one but must write
     *  to a different table. */
    handlers: Record<string, SyncEventHandler>
    /** First block to scan if sync_state has no row yet — avoids a full-chain rescan. */
    deployBlock: bigint
}

/** Every deployed contract to sync on one chain. Contracts not deployed on that chain (no address
 *  in config/contract-addresses.ts) are skipped, not errored on. */
export function getSyncTargets(chainId: number): SyncTarget[] {
    const addresses = getContractAddresses(chainId)
    const deployBlocks = getDeployBlocks(chainId)
    const targets: SyncTarget[] = []

    if (addresses.nftMarketplace) {
        targets.push({
            contract: 'nft_marketplace',
            chainId,
            address: addresses.nftMarketplace,
            abi: nftMarketplaceEventsAbi,
            handlers: marketplaceEventHandlers,
            deployBlock: deployBlocks.nftMarketplace ?? 0n,
        })
    }

    if (addresses.rwaEscrow) {
        targets.push({
            contract: 'rwa_escrow',
            chainId,
            address: addresses.rwaEscrow,
            abi: rwaEscrowEventsAbi,
            handlers: marketplaceEventHandlers,
            deployBlock: deployBlocks.rwaEscrow ?? 0n,
        })
    }

    if (addresses.redeemNftSettlement) {
        targets.push({
            contract: 'redeem_nft_settlement',
            chainId,
            address: addresses.redeemNftSettlement,
            abi: redeemNftSettlementEventsAbi,
            handlers: redeemNftEventHandlers,
            deployBlock: deployBlocks.redeemNftSettlement ?? 0n,
        })
    }

    // A second, independent RwaEscrow deployment dedicated to Redeem merch (different feeBps —
    // 10% platform fee — and a different feeCollector than the Marketplace instance above); see
    // supabase/migrations/0008_redeem_schema.sql's header comment for why merch reuses this
    // contract's code instead of a bespoke escrow.
    if (addresses.redeemRwaEscrow) {
        targets.push({
            contract: 'redeem_rwa_escrow',
            chainId,
            address: addresses.redeemRwaEscrow,
            abi: rwaEscrowEventsAbi,
            handlers: redeemRwaEventHandlers,
            deployBlock: deployBlocks.redeemRwaEscrow ?? 0n,
        })
    }

    if (addresses.airdropEscrow) {
        targets.push({
            contract: 'airdrop_escrow',
            chainId,
            address: addresses.airdropEscrow,
            abi: airdropEscrowEventsAbi,
            handlers: airdropEventHandlers,
            deployBlock: deployBlocks.airdropEscrow ?? 0n,
        })
    }

    return targets
}
