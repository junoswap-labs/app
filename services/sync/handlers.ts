import type { Log } from 'viem'
import { supabaseAdmin } from '@/lib/supabase/server'
import { campaignShareHash } from '@/lib/onchain/airdrop-share'

// Every handler below is idempotent: nft_orders/rwa_orders/redemption_orders writes are guarded
// UPDATEs (`.eq('status', expectedPriorStatus)`) so a reprocessed/overlapping log can't regress
// state, and the audit_logs insert relies on its (tx_hash, log_index) partial unique index — a
// reprocessed log's audit insert just hits a 23505 conflict, which is swallowed as "already
// logged", not an error. This is what makes services/sync/poller.ts safe to re-run over any
// block range, including one it already processed.
//
// Multi-chain: the poller sweeps every supported chain and passes the originating chainId in `ctx`.
// Rows the poller creates carry `chain_id`; guarded UPDATEs/reads that key on a backend-minted
// bytes32 id (order_hash, listingId, campaignId) also scope by chain_id so a testnet id can never
// touch a mainnet row even in the astronomically unlikely event the two collide.

export interface DecodedLog extends Log {
    eventName: string
    args: Record<string, unknown>
}

export interface SyncContext {
    chainId: number
}

export type SyncEventHandler = (log: DecodedLog, ctx: SyncContext) => Promise<void>

async function logAudit(params: {
    chainId: number
    action: string
    subjectType: string
    subjectId: string
    oldStatus?: string
    newStatus?: string
    log: DecodedLog
    metadata?: Record<string, unknown>
}): Promise<void> {
    const { error } = await supabaseAdmin()
        .from('audit_logs')
        .insert({
            category: 'sync',
            action: params.action,
            actor_wallet: null,
            actor_type: 'system',
            subject_type: params.subjectType,
            subject_id: params.subjectId,
            chain_id: params.chainId,
            old_status: params.oldStatus ?? null,
            new_status: params.newStatus ?? null,
            tx_hash: params.log.transactionHash,
            block_number: params.log.blockNumber?.toString() ?? null,
            log_index: params.log.logIndex,
            request_ip: null,
            user_agent: null,
            tg_update_id: null,
            metadata: params.metadata ?? null,
        })
    if (error && error.code !== '23505') throw error
}

export async function handleOrderFulfilled(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { orderHash, buyer, fee } = log.args as { orderHash: string; buyer: string; fee: bigint }
    const { error } = await supabaseAdmin()
        .from('nft_orders')
        .update({ status: 'filled', buyer: buyer.toLowerCase(), fee: fee.toString(), filled_at: new Date().toISOString() })
        .eq('order_hash', orderHash)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'active')
    if (error) throw error
    await logAudit({ chainId: ctx.chainId, action: 'order.fulfilled', subjectType: 'nft_order', subjectId: orderHash, newStatus: 'filled', log })
}

export async function handleOrderCancelled(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { orderHash } = log.args as { orderHash: string }
    const { error } = await supabaseAdmin()
        .from('nft_orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('order_hash', orderHash)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'active')
    if (error) throw error
    await logAudit({ chainId: ctx.chainId, action: 'order.cancelled', subjectType: 'nft_order', subjectId: orderHash, newStatus: 'cancelled', log })
}

export async function handleRwaFunded(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, seller, buyer, paymentToken, amount, fundedAt } = log.args as {
        listingId: string
        seller: string
        buyer: string
        paymentToken: string
        amount: bigint
        fundedAt: bigint
    }
    // First time this listing enters rwa_orders — insert, not update. Ignore a duplicate insert
    // from a reprocessed log rather than erroring.
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .upsert(
            {
                id: listingId,
                chain_id: ctx.chainId,
                seller_wallet: seller.toLowerCase(),
                buyer_wallet: buyer.toLowerCase(),
                payment_token: paymentToken,
                amount: amount.toString(),
                status: 'Funded',
                funded_at: new Date(Number(fundedAt) * 1000).toISOString(),
            },
            { onConflict: 'id', ignoreDuplicates: true }
        )
    if (error) throw error
    await supabaseAdmin()
        .from('rwa_listings')
        .update({ status: 'funded' })
        .eq('id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'active')
    await logAudit({ chainId: ctx.chainId, action: 'rwa.funded', subjectType: 'rwa_order', subjectId: listingId, newStatus: 'Funded', log })
}

export async function handleRwaShipped(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, shippedAt } = log.args as { listingId: string; shippedAt: bigint }
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Shipped', shipped_at: new Date(Number(shippedAt) * 1000).toISOString() })
        .eq('id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Funded')
    if (error) throw error
    await logAudit({
        chainId: ctx.chainId,
        action: 'rwa.shipped',
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Funded',
        newStatus: 'Shipped',
        log,
    })
}

async function completeRwaOrder(
    log: DecodedLog,
    ctx: SyncContext,
    listingId: string,
    fee: bigint,
    action: 'rwa.completed' | 'rwa.auto_released'
): Promise<void> {
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Completed', fee: fee.toString(), completed_at: new Date().toISOString() })
        .eq('id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Shipped')
    if (error) throw error
    await logAudit({
        chainId: ctx.chainId,
        action,
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Shipped',
        newStatus: 'Completed',
        log,
    })
}

/** Ordinary confirmReceived() completion. */
export async function handleRwaCompleted(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, fee } = log.args as { listingId: string; fee: bigint }
    await completeRwaOrder(log, ctx, listingId, fee, 'rwa.completed')
}

/** claimShipmentTimeout() completion — same DB effect as handleRwaCompleted, different audit action
 *  so history distinguishes "buyer confirmed" from "buyer never confirmed, auto-released". */
export async function handleRwaAutoReleased(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, fee } = log.args as { listingId: string; fee: bigint }
    await completeRwaOrder(log, ctx, listingId, fee, 'rwa.auto_released')
}

export async function handleRwaRefunded(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Refunded' })
        .eq('id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Funded')
    if (error) throw error
    await logAudit({
        chainId: ctx.chainId,
        action: 'rwa.refunded',
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Funded',
        newStatus: 'Refunded',
        log,
    })
}

export async function handleRwaDisputeOpened(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Disputed' })
        .eq('id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Shipped')
    if (error) throw error
    await logAudit({
        chainId: ctx.chainId,
        action: 'rwa.dispute_opened',
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Shipped',
        newStatus: 'Disputed',
        log,
    })
}

export async function handleRwaDisputeResolved(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, releasedToSeller } = log.args as { listingId: string; releasedToSeller: boolean }
    const newStatus = releasedToSeller ? 'ResolvedSeller' : 'ResolvedBuyer'
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: newStatus, resolved_at: new Date().toISOString() })
        .eq('id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Disputed')
    if (error) throw error
    await logAudit({
        chainId: ctx.chainId,
        action: 'rwa.dispute_resolved',
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Disputed',
        newStatus,
        log,
    })
}

/** nft_marketplace + rwa_escrow (Marketplace P2P trading) — writes nft_orders/rwa_orders/rwa_listings. */
export const marketplaceEventHandlers: Record<string, SyncEventHandler> = {
    OrderFulfilled: handleOrderFulfilled,
    OrderCancelled: handleOrderCancelled,
    RwaFunded: handleRwaFunded,
    RwaShipped: handleRwaShipped,
    RwaCompleted: handleRwaCompleted,
    RwaAutoReleased: handleRwaAutoReleased,
    RwaRefunded: handleRwaRefunded,
    RwaDisputeOpened: handleRwaDisputeOpened,
    RwaDisputeResolved: handleRwaDisputeResolved,
}

// ---------------------------------------------------------------------------------------------
// Redeem — a second, dedicated RwaEscrow deployment reuses the exact same event names as the
// Marketplace instance above, so it needs its own handler map writing to redemption_orders instead
// of rwa_orders/rwa_listings (see lib/onchain/sync-contracts.ts, which routes each deployed
// contract to its own handler map rather than one global eventName -> handler lookup).

async function logRedeemAudit(params: {
    chainId: number
    action: string
    subjectId: string
    oldStatus?: string
    newStatus?: string
    log: DecodedLog
    metadata?: Record<string, unknown>
}): Promise<void> {
    const { error } = await supabaseAdmin()
        .from('audit_logs')
        .insert({
            category: 'sync',
            action: params.action,
            actor_wallet: null,
            actor_type: 'system',
            subject_type: 'redemption_order',
            subject_id: params.subjectId,
            chain_id: params.chainId,
            old_status: params.oldStatus ?? null,
            new_status: params.newStatus ?? null,
            tx_hash: params.log.transactionHash,
            block_number: params.log.blockNumber?.toString() ?? null,
            log_index: params.log.logIndex,
            request_ip: null,
            user_agent: null,
            tg_update_id: null,
            metadata: params.metadata ?? null,
        })
    if (error && error.code !== '23505') throw error
}

/**
 * Decrements the item/variant stock this order claimed — called only once, from the handler that
 * observes the buyer's on-chain payment/escrow confirming for the first time (never at order
 * creation, see the Route Handler's comment). Best-effort: if stock already hit 0 (two buyers
 * raced the same last unit and both paid on-chain before either got confirmed), the payment still
 * stands — there's no way to claw back a completed on-chain tx — so this just skips the decrement
 * rather than throwing, leaving the oversold order for an admin to notice and handle manually.
 * item_id/variant_id are DB serial PKs (globally unique), so no chain scoping is needed here.
 */
async function decrementRedeemStock(itemId: number, variantId: number | null): Promise<void> {
    if (variantId != null) {
        const { data: variant, error } = await supabaseAdmin()
            .from('redeem_item_variants')
            .select('stock')
            .eq('id', variantId)
            .maybeSingle()
        if (error) throw error
        if (!variant || variant.stock == null) return
        await supabaseAdmin()
            .from('redeem_item_variants')
            .update({ stock: variant.stock - 1 })
            .eq('id', variantId)
            .eq('stock', variant.stock)
            .gt('stock', 0)
    } else {
        const { data: item, error } = await supabaseAdmin()
            .from('redeem_items')
            .select('stock')
            .eq('id', itemId)
            .maybeSingle()
        if (error) throw error
        if (!item || item.stock == null) return
        await supabaseAdmin()
            .from('redeem_items')
            .update({ stock: item.stock - 1 })
            .eq('id', itemId)
            .eq('stock', item.stock)
            .gt('stock', 0)
    }
}

/** RedeemNftSettlement.NftRedeemed — the NFT leg settles atomically, straight to 'Completed'. */
export async function handleNftRedeemed(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { offerHash } = log.args as { offerHash: string }
    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ status: 'Completed', completed_at: new Date().toISOString() })
        .eq('offer_hash', offerHash)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'PendingPayment')
        .select('id, item_id, variant_id')
        .maybeSingle()
    if (error) throw error
    if (!data) return // already processed, or the row hasn't been inserted yet — safe to skip
    await decrementRedeemStock(data.item_id, data.variant_id)
    await logRedeemAudit({ chainId: ctx.chainId, action: 'redeem.nft_completed', subjectId: data.id, newStatus: 'Completed', log })
}

export async function handleRedeemRwaFunded(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, fundedAt } = log.args as { listingId: string; fundedAt: bigint }
    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ status: 'Funded', updated_at: new Date(Number(fundedAt) * 1000).toISOString() })
        .eq('escrow_listing_id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'PendingPayment')
        .select('id, item_id, variant_id')
        .maybeSingle()
    if (error) throw error
    if (!data) return
    await decrementRedeemStock(data.item_id, data.variant_id)
    await logRedeemAudit({
        chainId: ctx.chainId,
        action: 'redeem.merch_funded',
        subjectId: data.id,
        oldStatus: 'PendingPayment',
        newStatus: 'Funded',
        log,
    })
}

export async function handleRedeemRwaShipped(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, shippedAt } = log.args as { listingId: string; shippedAt: bigint }
    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ status: 'Shipped', shipped_at: new Date(Number(shippedAt) * 1000).toISOString() })
        .eq('escrow_listing_id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Funded')
        .select('id')
        .maybeSingle()
    if (error) throw error
    if (!data) return
    await logRedeemAudit({
        chainId: ctx.chainId,
        action: 'redeem.merch_shipped',
        subjectId: data.id,
        oldStatus: 'Funded',
        newStatus: 'Shipped',
        log,
    })
}

async function completeRedeemOrder(log: DecodedLog, ctx: SyncContext, listingId: string, action: string): Promise<void> {
    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ status: 'Completed', completed_at: new Date().toISOString() })
        .eq('escrow_listing_id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Shipped')
        .select('id')
        .maybeSingle()
    if (error) throw error
    if (!data) return
    await logRedeemAudit({ chainId: ctx.chainId, action, subjectId: data.id, oldStatus: 'Shipped', newStatus: 'Completed', log })
}

export async function handleRedeemRwaCompleted(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    await completeRedeemOrder(log, ctx, listingId, 'redeem.merch_completed')
}

export async function handleRedeemRwaAutoReleased(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    await completeRedeemOrder(log, ctx, listingId, 'redeem.merch_auto_released')
}

export async function handleRedeemRwaRefunded(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ status: 'Refunded' })
        .eq('escrow_listing_id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Funded')
        .select('id')
        .maybeSingle()
    if (error) throw error
    if (!data) return
    await logRedeemAudit({
        chainId: ctx.chainId,
        action: 'redeem.merch_refunded',
        subjectId: data.id,
        oldStatus: 'Funded',
        newStatus: 'Refunded',
        log,
    })
}

export async function handleRedeemRwaDisputeOpened(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ status: 'Disputed' })
        .eq('escrow_listing_id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Shipped')
        .select('id')
        .maybeSingle()
    if (error) throw error
    if (!data) return
    await logRedeemAudit({
        chainId: ctx.chainId,
        action: 'redeem.merch_dispute_opened',
        subjectId: data.id,
        oldStatus: 'Shipped',
        newStatus: 'Disputed',
        log,
    })
}

export async function handleRedeemRwaDisputeResolved(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { listingId, releasedToSeller } = log.args as { listingId: string; releasedToSeller: boolean }
    const newStatus = releasedToSeller ? 'ResolvedSeller' : 'ResolvedBuyer'
    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ status: newStatus, resolved_at: new Date().toISOString() })
        .eq('escrow_listing_id', listingId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'Disputed')
        .select('id')
        .maybeSingle()
    if (error) throw error
    if (!data) return
    await logRedeemAudit({
        chainId: ctx.chainId,
        action: 'redeem.merch_dispute_resolved',
        subjectId: data.id,
        oldStatus: 'Disputed',
        newStatus,
        log,
    })
}

/** redeem_nft_settlement deployment. */
export const redeemNftEventHandlers: Record<string, SyncEventHandler> = {
    NftRedeemed: handleNftRedeemed,
}

/** redeem_rwa_escrow deployment — the Redeem-dedicated RwaEscrow instance. */
export const redeemRwaEventHandlers: Record<string, SyncEventHandler> = {
    RwaFunded: handleRedeemRwaFunded,
    RwaShipped: handleRedeemRwaShipped,
    RwaCompleted: handleRedeemRwaCompleted,
    RwaAutoReleased: handleRedeemRwaAutoReleased,
    RwaRefunded: handleRedeemRwaRefunded,
    RwaDisputeOpened: handleRedeemRwaDisputeOpened,
    RwaDisputeResolved: handleRedeemRwaDisputeResolved,
}

// ---------------------------------------------------------------------------------------------
// Airdrop — contracts/src/AirdropEscrow.sol. airdrop_campaigns.remaining_amount/claimed_count are
// running counters (unlike the 1:1 status columns above), so a reprocessed AirdropClaimed log must
// not double-decrement them. Idempotency here is anchored on airdrop_claims' (tx_hash, log_index)
// unique index instead of a status guard: the counter update only runs when the claims upsert
// actually inserted a new row (checked via .select().maybeSingle() returning non-null, same idiom
// handleNftRedeemed uses), and itself uses an optimistic-lock guard (.eq('claimed_count', ...)) so
// two overlapping runSync() calls can't lose an update — a lost race just throws, which leaves
// sync_state unadvanced and retries cleanly on the next run (see services/sync/poller.ts).

async function logAirdropAudit(params: {
    chainId: number
    action: string
    subjectId: string
    oldStatus?: string
    newStatus?: string
    log: DecodedLog
    metadata?: Record<string, unknown>
}): Promise<void> {
    const { error } = await supabaseAdmin()
        .from('audit_logs')
        .insert({
            category: 'sync',
            action: params.action,
            actor_wallet: null,
            actor_type: 'system',
            subject_type: 'airdrop_campaign',
            subject_id: params.subjectId,
            chain_id: params.chainId,
            old_status: params.oldStatus ?? null,
            new_status: params.newStatus ?? null,
            tx_hash: params.log.transactionHash,
            block_number: params.log.blockNumber?.toString() ?? null,
            log_index: params.log.logIndex,
            request_ip: null,
            user_agent: null,
            tg_update_id: null,
            metadata: params.metadata ?? null,
        })
    if (error && error.code !== '23505') throw error
}

export async function handleAirdropCampaignCreated(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const {
        campaignId,
        creator,
        token,
        totalAmount,
        amountMode,
        fixedAmount,
        minAmount,
        maxAmount,
        maxClaimants,
        expiresAt,
        gasMode,
        gasDeposit,
    } = log.args as {
        campaignId: string
        creator: string
        token: string
        totalAmount: bigint
        amountMode: number
        fixedAmount: bigint
        minAmount: bigint
        maxAmount: bigint
        maxClaimants: number
        expiresAt: bigint
        gasMode: number
        gasDeposit: bigint
    }
    const { error } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .upsert(
            {
                id: campaignId,
                chain_id: ctx.chainId,
                creator_wallet: creator.toLowerCase(),
                token,
                amount_mode: amountMode === 0 ? 'fixed' : 'random',
                fixed_amount: fixedAmount > 0n ? fixedAmount.toString() : null,
                min_amount: minAmount > 0n ? minAmount.toString() : null,
                max_amount: maxAmount > 0n ? maxAmount.toString() : null,
                total_amount: totalAmount.toString(),
                remaining_amount: totalAmount.toString(),
                max_claimants: maxClaimants,
                expires_at: expiresAt > 0n ? new Date(Number(expiresAt) * 1000).toISOString() : null,
                gas_mode: gasMode === 0 ? 'self' : 'relayer',
                gas_deposit: gasDeposit.toString(),
                share_hash: campaignShareHash(campaignId as `0x${string}`),
                tx_hash: log.transactionHash,
                status: 'active',
            },
            { onConflict: 'id', ignoreDuplicates: true }
        )
    if (error) throw error

    // The metadata route seeds this row from an on-chain read when a creator saves their
    // title/image before the poller reaches the block (see that route's seedFromChain) — that path
    // can't know the tx hash. The upsert above is ignoreDuplicates, so fill it in here; scoped to
    // rows where it's still null so a replayed log never rewrites anything else.
    await supabaseAdmin()
        .from('airdrop_campaigns')
        .update({ tx_hash: log.transactionHash })
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .is('tx_hash', null)

    await logAirdropAudit({ chainId: ctx.chainId, action: 'airdrop.campaign_created', subjectId: campaignId, newStatus: 'active', log })
}

export async function handleAirdropClaimed(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { campaignId, recipient, amount, submitter, closesCampaign } = log.args as {
        campaignId: string
        recipient: string
        amount: bigint
        submitter: string
        closesCampaign: boolean
    }

    const { data: inserted, error: insertError } = await supabaseAdmin()
        .from('airdrop_claims')
        .upsert(
            {
                campaign_id: campaignId,
                chain_id: ctx.chainId,
                recipient_wallet: recipient.toLowerCase(),
                amount: amount.toString(),
                tx_hash: log.transactionHash ?? '',
                log_index: log.logIndex ?? 0,
                submitter: submitter.toLowerCase() === recipient.toLowerCase() ? 'self' : 'relayer',
            },
            { onConflict: 'tx_hash,log_index', ignoreDuplicates: true }
        )
        .select('id')
        .maybeSingle()
    if (insertError) throw insertError
    if (!inserted) return // already processed by an earlier/overlapping sync run

    const { data: campaign, error: readError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .select('remaining_amount, claimed_count')
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .single()
    if (readError) throw readError

    const newRemaining = BigInt(campaign.remaining_amount) - amount
    const newClaimedCount = campaign.claimed_count + 1

    const { data: updated, error: updateError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .update({
            remaining_amount: newRemaining.toString(),
            claimed_count: newClaimedCount,
            status: closesCampaign ? 'closed' : 'active',
        })
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .eq('claimed_count', campaign.claimed_count) // optimistic lock — see header comment
        .select('id')
        .maybeSingle()
    if (updateError) throw updateError
    if (!updated) throw new Error(`airdrop_campaigns ${campaignId} claimed_count changed concurrently — retry`)

    await logAirdropAudit({
        chainId: ctx.chainId,
        action: 'airdrop.claimed',
        subjectId: campaignId,
        newStatus: closesCampaign ? 'closed' : 'active',
        log,
        metadata: { recipient, amount: amount.toString() },
    })
}

export async function handleAirdropCampaignClosed(log: DecodedLog, ctx: SyncContext): Promise<void> {
    // Emitted alongside AirdropClaimed's closesCampaign=true (handled above already) — this handler
    // only matters for completeness/idempotency if it's ever processed on its own.
    const { campaignId } = log.args as { campaignId: string }
    const { error } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .update({ status: 'closed' })
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .eq('status', 'active')
    if (error) throw error
}

export async function handleAirdropCampaignReclaimed(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { campaignId } = log.args as { campaignId: string }
    const { error } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .update({ remaining_amount: '0', status: 'reclaimed' })
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .neq('status', 'reclaimed')
    if (error) throw error
    await logAirdropAudit({ chainId: ctx.chainId, action: 'airdrop.reclaimed', subjectId: campaignId, newStatus: 'reclaimed', log })
}

/** gas_spent is a running counter too, so idempotency is anchored the same way as
 *  handleAirdropClaimed above: on airdrop_gas_reimbursements' (tx_hash, log_index) unique index,
 *  via the same "insert first, only proceed if it actually landed" idiom. */
export async function handleAirdropGasReimbursed(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { campaignId, amount } = log.args as { campaignId: string; relayer: string; amount: bigint }

    const { data: inserted, error: insertError } = await supabaseAdmin()
        .from('airdrop_gas_reimbursements')
        .upsert(
            {
                campaign_id: campaignId,
                chain_id: ctx.chainId,
                tx_hash: log.transactionHash ?? '',
                log_index: log.logIndex ?? 0,
                amount: amount.toString(),
            },
            { onConflict: 'tx_hash,log_index', ignoreDuplicates: true }
        )
        .select('id')
        .maybeSingle()
    if (insertError) throw insertError
    if (!inserted) return // already processed by an earlier/overlapping sync run

    const { data: campaign, error: readError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .select('gas_spent')
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .single()
    if (readError) throw readError

    const { data: updated, error: updateError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .update({ gas_spent: (BigInt(campaign.gas_spent) + amount).toString() })
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .eq('gas_spent', campaign.gas_spent) // optimistic lock, same idiom as claimed_count above
        .select('id')
        .maybeSingle()
    if (updateError) throw updateError
    if (!updated) throw new Error(`airdrop_campaigns ${campaignId} gas_spent changed concurrently — retry`)
}

/** Idempotent regardless of reprocessing — setting gas_spent to the deposit's full amount is the
 *  same result no matter how many times a reprocessed GasReclaimed log runs it. */
export async function handleAirdropGasReclaimed(log: DecodedLog, ctx: SyncContext): Promise<void> {
    const { campaignId } = log.args as { campaignId: string; to: string; amount: bigint }
    const { data: campaign, error: readError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .select('gas_deposit')
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
        .single()
    if (readError) throw readError

    const { error: updateError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .update({ gas_spent: campaign.gas_deposit })
        .eq('id', campaignId)
        .eq('chain_id', ctx.chainId)
    if (updateError) throw updateError
}

/** airdrop_escrow deployment. */
export const airdropEventHandlers: Record<string, SyncEventHandler> = {
    CampaignCreated: handleAirdropCampaignCreated,
    AirdropClaimed: handleAirdropClaimed,
    CampaignClosed: handleAirdropCampaignClosed,
    CampaignReclaimed: handleAirdropCampaignReclaimed,
    GasReimbursed: handleAirdropGasReimbursed,
    GasReclaimed: handleAirdropGasReclaimed,
}
