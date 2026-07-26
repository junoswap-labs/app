import type { Log } from 'viem'
import { supabaseAdmin } from '@/lib/supabase/server'

// Every handler below is idempotent: nft_orders/rwa_orders writes are guarded UPDATEs
// (`.eq('status', expectedPriorStatus)`) so a reprocessed/overlapping log can't regress state,
// and the audit_logs insert relies on its (tx_hash, log_index) partial unique index — a
// reprocessed log's audit insert just hits a 23505 conflict, which is swallowed as "already
// logged", not an error. This is what makes services/sync/poller.ts safe to re-run over any
// block range, including one it already processed.

interface DecodedLog extends Log {
    eventName: string
    args: Record<string, unknown>
}

async function logAudit(params: {
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

export async function handleOrderFulfilled(log: DecodedLog): Promise<void> {
    const { orderHash, buyer, fee } = log.args as { orderHash: string; buyer: string; fee: bigint }
    const { error } = await supabaseAdmin()
        .from('nft_orders')
        .update({ status: 'filled', buyer, fee: fee.toString(), filled_at: new Date().toISOString() })
        .eq('order_hash', orderHash)
        .eq('status', 'active')
    if (error) throw error
    await logAudit({ action: 'order.fulfilled', subjectType: 'nft_order', subjectId: orderHash, newStatus: 'filled', log })
}

export async function handleOrderCancelled(log: DecodedLog): Promise<void> {
    const { orderHash } = log.args as { orderHash: string }
    const { error } = await supabaseAdmin()
        .from('nft_orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('order_hash', orderHash)
        .eq('status', 'active')
    if (error) throw error
    await logAudit({ action: 'order.cancelled', subjectType: 'nft_order', subjectId: orderHash, newStatus: 'cancelled', log })
}

export async function handleRwaFunded(log: DecodedLog): Promise<void> {
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
                seller_wallet: seller,
                buyer_wallet: buyer,
                payment_token: paymentToken,
                amount: amount.toString(),
                status: 'Funded',
                funded_at: new Date(Number(fundedAt) * 1000).toISOString(),
            },
            { onConflict: 'id', ignoreDuplicates: true }
        )
    if (error) throw error
    await supabaseAdmin().from('rwa_listings').update({ status: 'funded' }).eq('id', listingId).eq('status', 'active')
    await logAudit({ action: 'rwa.funded', subjectType: 'rwa_order', subjectId: listingId, newStatus: 'Funded', log })
}

export async function handleRwaShipped(log: DecodedLog): Promise<void> {
    const { listingId, shippedAt } = log.args as { listingId: string; shippedAt: bigint }
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Shipped', shipped_at: new Date(Number(shippedAt) * 1000).toISOString() })
        .eq('id', listingId)
        .eq('status', 'Funded')
    if (error) throw error
    await logAudit({
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
    listingId: string,
    fee: bigint,
    action: 'rwa.completed' | 'rwa.auto_released'
): Promise<void> {
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Completed', fee: fee.toString(), completed_at: new Date().toISOString() })
        .eq('id', listingId)
        .eq('status', 'Shipped')
    if (error) throw error
    await logAudit({
        action,
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Shipped',
        newStatus: 'Completed',
        log,
    })
}

/** Ordinary confirmReceived() completion. */
export async function handleRwaCompleted(log: DecodedLog): Promise<void> {
    const { listingId, fee } = log.args as { listingId: string; fee: bigint }
    await completeRwaOrder(log, listingId, fee, 'rwa.completed')
}

/** claimShipmentTimeout() completion — same DB effect as handleRwaCompleted, different audit action
 *  so history distinguishes "buyer confirmed" from "buyer never confirmed, auto-released". */
export async function handleRwaAutoReleased(log: DecodedLog): Promise<void> {
    const { listingId, fee } = log.args as { listingId: string; fee: bigint }
    await completeRwaOrder(log, listingId, fee, 'rwa.auto_released')
}

export async function handleRwaRefunded(log: DecodedLog): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Refunded' })
        .eq('id', listingId)
        .eq('status', 'Funded')
    if (error) throw error
    await logAudit({
        action: 'rwa.refunded',
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Funded',
        newStatus: 'Refunded',
        log,
    })
}

export async function handleRwaDisputeOpened(log: DecodedLog): Promise<void> {
    const { listingId } = log.args as { listingId: string }
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: 'Disputed' })
        .eq('id', listingId)
        .eq('status', 'Shipped')
    if (error) throw error
    await logAudit({
        action: 'rwa.dispute_opened',
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Shipped',
        newStatus: 'Disputed',
        log,
    })
}

export async function handleRwaDisputeResolved(log: DecodedLog): Promise<void> {
    const { listingId, releasedToSeller } = log.args as { listingId: string; releasedToSeller: boolean }
    const newStatus = releasedToSeller ? 'ResolvedSeller' : 'ResolvedBuyer'
    const { error } = await supabaseAdmin()
        .from('rwa_orders')
        .update({ status: newStatus, resolved_at: new Date().toISOString() })
        .eq('id', listingId)
        .eq('status', 'Disputed')
    if (error) throw error
    await logAudit({
        action: 'rwa.dispute_resolved',
        subjectType: 'rwa_order',
        subjectId: listingId,
        oldStatus: 'Disputed',
        newStatus,
        log,
    })
}

export const eventHandlers: Record<string, (log: DecodedLog) => Promise<void>> = {
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
