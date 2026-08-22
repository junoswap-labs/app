import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * STEP 3 fulfillment queue — an Admin sees every actionable merch order; a Registered lister sees
 * only orders against their own redeem_items (filtered by lister_wallet, not a role check, since
 * any wallet can be a lister once their item exists — the item's own creation already enforced
 * the on-chain PARTNER_REDEEM_ROLE gate). NFT-kind orders settle atomically on redeem and never
 * need lister action, so they're excluded here.
 */
export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const isAdmin = await isAdminOnChain(wallet as `0x${string}`)

    let query = supabaseAdmin()
        .from('redemption_orders')
        .select('*, redeem_items!inner(name, lister_wallet, image_urls), redeem_item_variants(label)')
        .eq('kind', 'merch')
        .in('status', ['Funded', 'Shipped'])

    if (!isAdmin) {
        query = query.eq('redeem_items.lister_wallet', wallet)
    }

    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const flattened = (data ?? []).map((row) => {
        const item = row.redeem_items as unknown as { name: string; lister_wallet: string; image_urls: string[] }
        const variant = row.redeem_item_variants as unknown as { label: string } | null
        const { redeem_items: _items, redeem_item_variants: _variants, ...rest } = row
        return { ...rest, item_name: item.name, item_image_url: item.image_urls?.[0] ?? null, variant_label: variant?.label ?? null }
    })
    return NextResponse.json(flattened)
}
