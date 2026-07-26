import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Seller-only delist before anyone funds it — purely a DB update (nothing on-chain exists yet
 * for an unfunded listing, unlike every other RWA action which is an on-chain tx the poller
 * reflects). Guarded to status='active' so a listing that's already been funded can't be
 * cancelled out from under a buyer.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (body?.status !== 'cancelled') {
        return NextResponse.json({ error: 'only status: "cancelled" is supported here' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin()
        .from('rwa_listings')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('seller_wallet', wallet)
        .eq('status', 'active')
        .select()
        .single()

    if (error) {
        return NextResponse.json(
            { error: 'listing not found, not yours, or no longer cancellable' },
            { status: 404 }
        )
    }
    return NextResponse.json(data)
}
