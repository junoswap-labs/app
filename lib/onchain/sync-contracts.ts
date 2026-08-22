import type { Address } from 'viem'
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

    const nftAddress = process.env.NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS
    if (nftAddress) {
        targets.push({
            contract: 'nft_marketplace',
            address: nftAddress as Address,
            abi: nftMarketplaceEventsAbi,
            handlers: marketplaceEventHandlers,
            deployBlock: BigInt(process.env.NFT_MARKETPLACE_DEPLOY_BLOCK ?? '0'),
        })
    }

    const rwaAddress = process.env.NEXT_PUBLIC_RWA_ESCROW_ADDRESS
    if (rwaAddress) {
        targets.push({
            contract: 'rwa_escrow',
            address: rwaAddress as Address,
            abi: rwaEscrowEventsAbi,
            handlers: marketplaceEventHandlers,
            deployBlock: BigInt(process.env.RWA_ESCROW_DEPLOY_BLOCK ?? '0'),
        })
    }

    const redeemNftAddress = process.env.NEXT_PUBLIC_REDEEM_NFT_SETTLEMENT_ADDRESS
    if (redeemNftAddress) {
        targets.push({
            contract: 'redeem_nft_settlement',
            address: redeemNftAddress as Address,
            abi: redeemNftSettlementEventsAbi,
            handlers: redeemNftEventHandlers,
            deployBlock: BigInt(process.env.REDEEM_NFT_SETTLEMENT_DEPLOY_BLOCK ?? '0'),
        })
    }

    // A second, independent RwaEscrow deployment dedicated to Redeem merch (different feeBps —
    // 10% platform fee — and a different feeCollector than the Marketplace instance above); see
    // supabase/migrations/0008_redeem_schema.sql's header comment for why merch reuses this
    // contract's code instead of a bespoke escrow.
    const redeemRwaAddress = process.env.NEXT_PUBLIC_REDEEM_RWA_ESCROW_ADDRESS
    if (redeemRwaAddress) {
        targets.push({
            contract: 'redeem_rwa_escrow',
            address: redeemRwaAddress as Address,
            abi: rwaEscrowEventsAbi,
            handlers: redeemRwaEventHandlers,
            deployBlock: BigInt(process.env.REDEEM_RWA_ESCROW_DEPLOY_BLOCK ?? '0'),
        })
    }

    const airdropAddress = process.env.NEXT_PUBLIC_AIRDROP_ESCROW_ADDRESS
    if (airdropAddress) {
        targets.push({
            contract: 'airdrop_escrow',
            address: airdropAddress as Address,
            abi: airdropEscrowEventsAbi,
            handlers: airdropEventHandlers,
            deployBlock: BigInt(process.env.AIRDROP_ESCROW_DEPLOY_BLOCK ?? '0'),
        })
    }

    return targets
}
