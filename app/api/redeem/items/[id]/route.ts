import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import { parseBaseUnitsAmount } from '@/lib/amount'
import type { RedeemItemStatus } from '@/types/redeem'
import type { Database } from '@/types/supabase'

type RedeemItemUpdate = Database['public']['Tables']['redeem_items']['Update']

// Single-item read/update for the lister's own listing (or an Admin editing anyone's). Editing is
// restricted to catalog/pricing/scheduling fields — tier/kind/lister_wallet/nft_contract/
// nft_token_id stay fixed after creation, same as the create route's own invariants.

async function loadOwnedItem(id: number, wallet: string) {
    const { data, error } = await supabaseAdmin().from('redeem_items').select('lister_wallet').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return { item: null, owned: false }
    const owned = data.lister_wallet === wallet || (await isAdminOnChain(wallet as `0x${string}`))
    return { item: data, owned }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const id = Number((await params).id)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid item id' }, { status: 400 })

    const { item, owned } = await loadOwnedItem(id, wallet)
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (!owned) return NextResponse.json({ error: 'not your listing' }, { status: 403 })

    const { data, error } = await supabaseAdmin().from('redeem_items').select('*, redeem_item_variants(*)').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ...data, variants: (data as { redeem_item_variants?: unknown }).redeem_item_variants })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const id = Number((await params).id)
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid item id' }, { status: 400 })

    const { item, owned } = await loadOwnedItem(id, wallet)
    if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (!owned) return NextResponse.json({ error: 'not your listing' }, { status: 403 })

    const body = await request.json().catch(() => null)
    const update: RedeemItemUpdate = {}

    if (typeof body?.name === 'string') {
        const name = body.name.trim()
        if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
        update.name = name
    }
    if (typeof body?.description === 'string') update.description = body.description.trim()
    if (Array.isArray(body?.image_urls)) update.image_urls = body.image_urls.filter((u: unknown) => typeof u === 'string')

    if (body?.price_points != null) {
        const pricePoints = parseBaseUnitsAmount(body.price_points)
        if (pricePoints === null) return NextResponse.json({ error: 'price_points must be a non-negative base-units integer string' }, { status: 400 })
        update.price_points = pricePoints
    }
    if ('payment_token' in (body ?? {})) {
        const paymentToken = typeof body.payment_token === 'string' && body.payment_token ? body.payment_token.toLowerCase() : null
        const paymentTokenSymbol = typeof body.payment_token_symbol === 'string' ? body.payment_token_symbol : null
        const paymentAmount = body.payment_amount != null ? parseBaseUnitsAmount(body.payment_amount) : null
        if (paymentToken && (!paymentTokenSymbol || paymentAmount === null)) {
            return NextResponse.json(
                { error: 'payment_token requires payment_token_symbol and a non-negative base-units payment_amount' },
                { status: 400 }
            )
        }
        update.payment_token = paymentToken
        update.payment_token_symbol = paymentTokenSymbol
        update.payment_amount = paymentAmount
    }

    if (body?.stock !== undefined) {
        const stock = body.stock != null ? Number(body.stock) : null
        if (stock != null && (!Number.isFinite(stock) || stock < 0)) {
            return NextResponse.json({ error: 'stock must be a non-negative number or null (unlimited)' }, { status: 400 })
        }
        update.stock = stock
    }

    if (typeof body?.thailand_only === 'boolean') update.thailand_only = body.thailand_only
    if (typeof body?.publish_at === 'string' || body?.publish_at === null) update.publish_at = body.publish_at || null
    if (typeof body?.redeem_start_at === 'string' || body?.redeem_start_at === null) update.redeem_start_at = body.redeem_start_at || null
    if (typeof body?.redeem_end_at === 'string' || body?.redeem_end_at === null) update.redeem_end_at = body.redeem_end_at || null

    if (typeof body?.status === 'string') {
        const status = body.status as RedeemItemStatus
        if (status !== 'draft' && status !== 'published' && status !== 'archived') {
            return NextResponse.json({ error: 'status must be "draft", "published", or "archived"' }, { status: 400 })
        }
        update.status = status
    }

    // Variant ("Options") sync — rows with a matching existing id are updated in place, rows with
    // no id (or an id that doesn't belong to this item) are inserted, and any existing row not
    // present in the submitted array is deleted. A variant already referenced by an order (FK on
    // redemption_orders.variant_id) can't be deleted — that surfaces as a normal 500 from the DB.
    let variantsChanged = false
    if (Array.isArray(body?.variants)) {
        const submitted = body.variants as { id?: number; label: string; sku?: string | null; stock?: number | null }[]
        const { data: existing, error: existingError } = await supabaseAdmin().from('redeem_item_variants').select('id').eq('item_id', id)
        if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
        const existingIds = new Set((existing ?? []).map((v) => v.id))
        const keepIds = new Set<number>()

        for (const v of submitted) {
            const label = typeof v.label === 'string' ? v.label.trim() : ''
            if (!label) continue
            const sku = typeof v.sku === 'string' && v.sku.trim() ? v.sku.trim() : null
            const vStock = v.stock != null ? Number(v.stock) : null
            if (vStock != null && (!Number.isFinite(vStock) || vStock < 0)) {
                return NextResponse.json({ error: 'each option\'s stock must be a non-negative number or null (unlimited)' }, { status: 400 })
            }
            if (v.id != null && existingIds.has(v.id)) {
                const { error } = await supabaseAdmin().from('redeem_item_variants').update({ label, sku, stock: vStock }).eq('id', v.id)
                if (error) return NextResponse.json({ error: error.message }, { status: 500 })
                keepIds.add(v.id)
            } else {
                const { error } = await supabaseAdmin().from('redeem_item_variants').insert({ item_id: id, label, sku, stock: vStock })
                if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            }
        }

        const toDelete = [...existingIds].filter((existingId) => !keepIds.has(existingId))
        if (toDelete.length > 0) {
            const { error } = await supabaseAdmin().from('redeem_item_variants').delete().in('id', toDelete)
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        }
        variantsChanged = true
        // Variants track stock per-option, not on the item row — keep them from disagreeing. Only
        // forced when options remain; submitting an empty array (dropping back to simple stock)
        // leaves `stock` to whatever the request's own stock field said, if any.
        if (keepIds.size > 0) update.stock = null
    }

    if (Object.keys(update).length === 0) {
        if (!variantsChanged) return NextResponse.json({ error: 'no editable fields provided' }, { status: 400 })
        const { data, error } = await supabaseAdmin().from('redeem_items').select('*, redeem_item_variants(*)').eq('id', id).single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    }

    const { data, error } = await supabaseAdmin().from('redeem_items').update(update).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
