import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import { DISPUTE_GRACE_MS } from '@/types/rwa'
import type { RedeemDisputeReason } from '@/types/redeem'

/**
 * Records off-chain evidence for a merch dispute (RwaEscrow.openDispute() itself carries no
 * reason/evidence param). Which reason a caller may file is derived from their role on the order,
 * not chosen freely — see report-dispute-dialog.tsx: the buyer can only claim the shipment was
 * faked, the seller (or an Admin, standing in for an 'official' item's treasury) can only claim the
 * buyer won't confirm. The caller still has to send the actual openDispute() tx themselves
 * afterwards — this route only persists the "why" so the admin/arbitrator queue has context.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail.trim().slice(0, 1000) : ''
    const evidenceUrls = Array.isArray(body?.evidence_urls) ? body.evidence_urls.filter((u: unknown) => typeof u === 'string').slice(0, 3) : []
    if (!detail) return NextResponse.json({ error: 'detail is required' }, { status: 400 })

    const { data: order, error: fetchError } = await supabaseAdmin()
        .from('redemption_orders')
        .select('*, redeem_items!inner(payout_wallet, tier)')
        .eq('id', id)
        .maybeSingle()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })
    if (order.kind !== 'merch' || !order.escrow_listing_id) {
        return NextResponse.json({ error: 'only merch orders can be disputed' }, { status: 400 })
    }
    if (order.status !== 'Shipped' || !order.shipped_at) {
        return NextResponse.json({ error: 'this order is not in the Shipped state' }, { status: 409 })
    }
    if (Date.now() < new Date(order.shipped_at).getTime() + DISPUTE_GRACE_MS) {
        return NextResponse.json({ error: 'the dispute grace period has not passed yet' }, { status: 409 })
    }

    const item = order.redeem_items as unknown as { payout_wallet: string | null; tier: 'official' | 'registered' }
    const isBuyer = order.buyer_wallet === wallet
    const isSeller = (item.tier === 'registered' && item.payout_wallet === wallet) || (item.tier === 'official' && (await isAdminOnChain(wallet as `0x${string}`)))
    let reason: RedeemDisputeReason
    if (isBuyer) reason = 'fake_shipment'
    else if (isSeller) reason = 'buyer_unresponsive'
    else return NextResponse.json({ error: 'not a party to this order' }, { status: 403 })

    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({
            dispute_reason: reason,
            dispute_detail: detail,
            dispute_evidence_urls: evidenceUrls,
            dispute_reported_by: wallet,
            dispute_reported_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin().from('audit_logs').insert({
        category: 'client',
        action: 'redeem.dispute_reported',
        actor_wallet: wallet,
        actor_type: isBuyer ? 'buyer' : 'lister',
        subject_type: 'redemption_order',
        subject_id: id,
        old_status: null,
        new_status: null,
        tx_hash: null,
        block_number: null,
        log_index: null,
        request_ip: null,
        user_agent: null,
        tg_update_id: null,
        metadata: { reason, detail, evidence_urls: evidenceUrls, escrow_listing_id: order.escrow_listing_id },
    })

    return NextResponse.json(data)
}
