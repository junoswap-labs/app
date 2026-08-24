import type { Address } from 'viem'
import { CONTRACT_ADDRESSES, DEPLOY_BLOCKS } from '@/config/contract-addresses'
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

/** Contracts not yet deployed (no NEXT_PUBLIC_*_ADDRESS set) are skipped, not errored on. */
export function getSyncTargets(): SyncTarget[] {
    const targets: SyncTarget[] = []

    const nftAddress = CONTRACT_ADDRESSES.nftMarketplace
    if (nftAddress) {
        targets.push({
            contract: 'nft_marketplace',
            address: nftAddress,
            abi: nftMarketplaceEventsAbi,
            handlers: marketplaceEventHandlers,
            deployBlock: DEPLOY_BLOCKS.nftMarketplace ?? 0n,
        })
    }

    const rwaAddress = CONTRACT_ADDRESSES.rwaEscrow
    if (rwaAddress) {
        targets.push({
            contract: 'rwa_escrow',
            address: rwaAddress,
            abi: rwaEscrowEventsAbi,
            handlers: marketplaceEventHandlers,
            deployBlock: DEPLOY_BLOCKS.rwaEscrow ?? 0n,
        })
    }

    const redeemNftAddress = CONTRACT_ADDRESSES.redeemNftSettlement
    if (redeemNftAddress) {
        targets.push({
            contract: 'redeem_nft_settlement',
            address: redeemNftAddress,
            abi: redeemNftSettlementEventsAbi,
            handlers: redeemNftEventHandlers,
            deployBlock: DEPLOY_BLOCKS.redeemNftSettlement ?? 0n,
        })
    }

    // A second, independent RwaEscrow deployment dedicated to Redeem merch (different feeBps —
    // 10% platform fee — and a different feeCollector than the Marketplace instance above); see
    // supabase/migrations/0008_redeem_schema.sql's header comment for why merch reuses this
    // contract's code instead of a bespoke escrow.
    const redeemRwaAddress = CONTRACT_ADDRESSES.redeemRwaEscrow
    if (redeemRwaAddress) {
        targets.push({
            contract: 'redeem_rwa_escrow',
            address: redeemRwaAddress,
            abi: rwaEscrowEventsAbi,
            handlers: redeemRwaEventHandlers,
            deployBlock: DEPLOY_BLOCKS.redeemRwaEscrow ?? 0n,
        })
    }

    const airdropAddress = CONTRACT_ADDRESSES.airdropEscrow
    if (airdropAddress) {
        targets.push({
            contract: 'airdrop_escrow',
            address: airdropAddress,
            abi: airdropEscrowEventsAbi,
            handlers: airdropEventHandlers,
            deployBlock: DEPLOY_BLOCKS.airdropEscrow ?? 0n,
        })
    }

    return targets
}
