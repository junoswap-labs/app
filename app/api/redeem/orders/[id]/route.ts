import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * STEP 3.1 — attach a tracking number. This is purely off-chain metadata: RwaEscrow.sol has no
 * concept of a tracking number, so unlike every status transition it's fine for a Route Handler to
 * write it directly rather than waiting on the sync poller. Only the item's own lister or an Admin
 * may set it, and only while the order is still Funded/Shipped (not after it's settled).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const trackingNumber = typeof body?.tracking_number === 'string' ? body.tracking_number.trim() : ''
    if (!trackingNumber) return NextResponse.json({ error: 'tracking_number is required' }, { status: 400 })

    const { data: order, error: fetchError } = await supabaseAdmin()
        .from('redemption_orders')
        .select('*, redeem_items!inner(lister_wallet)')
        .eq('id', id)
        .maybeSingle()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })

    const isLister = (order.redeem_items as unknown as { lister_wallet: string }).lister_wallet === wallet
    if (!isLister && !(await isAdminOnChain(wallet as `0x${string}`))) {
        return NextResponse.json({ error: 'not this order\'s lister or an admin' }, { status: 403 })
    }
    if (order.status !== 'Funded' && order.status !== 'Shipped') {
        return NextResponse.json({ error: 'tracking can only be attached to a Funded or Shipped order' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .update({ tracking_number: trackingNumber, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin().from('audit_logs').insert({
        category: 'admin',
        action: 'redeem.tracking_attached',
        actor_wallet: wallet,
        actor_type: isLister ? 'lister' : 'admin',
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
        metadata: { tracking_number: trackingNumber },
    })

    return NextResponse.json(data)
}
