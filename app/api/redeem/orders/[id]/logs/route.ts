import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Redemption history for the Step-2 detail page ("redeem logs") — reuses audit_logs (see
 * services/sync/handlers.ts's redeem.* actions + app/api/redeem/orders/[id]'s
 * redeem.tracking_attached) rather than a bespoke table. audit_logs has no public-read RLS policy
 * (it's an internal audit trail, service-role only), so this route gates on being the order's own
 * buyer, its item's lister, or an Admin.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const { data: order, error: orderError } = await supabaseAdmin()
        .from('redemption_orders')
        .select('buyer_wallet, redeem_items!inner(lister_wallet)')
        .eq('id', id)
        .maybeSingle()
    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })
    if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })

    const listerWallet = (order.redeem_items as unknown as { lister_wallet: string }).lister_wallet
    const isParty = order.buyer_wallet === wallet || listerWallet === wallet
    if (!isParty && !(await isAdminOnChain(wallet as `0x${string}`))) {
        return NextResponse.json({ error: 'not a party to this order' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin()
        .from('audit_logs')
        .select('*')
        .eq('subject_type', 'redemption_order')
        .eq('subject_id', id)
        .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
