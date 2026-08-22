import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'
import { computeRedeemOfferHash, redeemOfferDomain, REDEEM_OFFER_TYPES, type RedeemOffer } from '@/lib/eip712'
import type { ShippingInfo } from '@/types/redeem'

async function logOrderCreated(orderId: string, actorWallet: string, metadata: Record<string, unknown>) {
    await supabaseAdmin().from('audit_logs').insert({
        category: 'client',
        action: 'redeem.order_created',
        actor_wallet: actorWallet,
        actor_type: 'buyer',
        subject_type: 'redemption_order',
        subject_id: orderId,
        old_status: null,
        new_status: 'PendingPayment',
        tx_hash: null,
        block_number: null,
        log_index: null,
        request_ip: null,
        user_agent: null,
        tg_update_id: null,
        metadata,
    })
}

/**
 * STEP 2 — "กดคลิกแลกสินค้า": creates the redemption order and, depending on kind, hands the
 * frontend what it needs to actually pay on-chain with the buyer's own wallet:
 *  - kind: 'nft'   -> a server-signed RedeemOffer + signature for RedeemNftSettlement.redeem()
 *  - kind: 'merch' -> a freshly minted escrow listingId for the Redeem RwaEscrow deployment's fund()
 * The row is inserted here as 'PendingPayment' — every later status is written ONLY by the sync
 * poller once the real on-chain tx confirms, per CLAUDE.md's Clean Workflow rule. Stock is
 * decremented here, guarded by an optimistic-lock UPDATE so two concurrent redeems can't both
 * claim the last unit.
 */
export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const itemId = Number(body?.item_id)
    const variantId = body?.variant_id != null ? Number(body.variant_id) : null
    if (!Number.isInteger(itemId)) {
        return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }

    const { data: item, error: itemError } = await supabaseAdmin()
        .from('redeem_items')
        .select('*')
        .eq('id', itemId)
        .eq('status', 'published')
        .maybeSingle()
    if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'item not found or not published' }, { status: 404 })

    const now = Date.now()
    if (item.redeem_start_at && now < new Date(item.redeem_start_at).getTime()) {
        return NextResponse.json({ error: 'redeeming this item has not opened yet' }, { status: 403 })
    }
    if (item.redeem_end_at && now > new Date(item.redeem_end_at).getTime()) {
        return NextResponse.json({ error: 'the redeem window for this item has closed' }, { status: 403 })
    }

    let variant: { id: number; stock: number | null } | null = null
    if (variantId != null) {
        const { data, error } = await supabaseAdmin()
            .from('redeem_item_variants')
            .select('id, stock')
            .eq('id', variantId)
            .eq('item_id', itemId)
            .maybeSingle()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!data) return NextResponse.json({ error: 'variant not found for this item' }, { status: 404 })
        variant = data
    }

    // Automatic stock deduction (single-attempt optimistic lock — matches the store level below).
    if (variant) {
        if (variant.stock != null) {
            if (variant.stock <= 0) return NextResponse.json({ error: 'out of stock' }, { status: 409 })
            const { data: decremented, error } = await supabaseAdmin()
                .from('redeem_item_variants')
                .update({ stock: variant.stock - 1 })
                .eq('id', variant.id)
                .eq('stock', variant.stock)
                .select('id')
                .maybeSingle()
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            if (!decremented) return NextResponse.json({ error: 'out of stock — please try again' }, { status: 409 })
        }
    } else if (item.stock != null) {
        if (item.stock <= 0) return NextResponse.json({ error: 'out of stock' }, { status: 409 })
        const { data: decremented, error } = await supabaseAdmin()
            .from('redeem_items')
            .update({ stock: item.stock - 1 })
            .eq('id', item.id)
            .eq('stock', item.stock)
            .select('id')
            .maybeSingle()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!decremented) return NextResponse.json({ error: 'out of stock — please try again' }, { status: 409 })
    }

    const baseOrder = {
        item_id: item.id,
        variant_id: variant?.id ?? null,
        buyer_wallet: wallet,
        tier: item.tier,
        kind: item.kind,
        price_points: item.price_points,
        payment_token: item.payment_token,
        payment_token_symbol: item.payment_token_symbol,
        payment_amount: item.payment_amount,
        status: 'PendingPayment' as const,
    }

    if (item.kind === 'nft') {
        const operatorKey = process.env.REDEEM_OPERATOR_PRIVATE_KEY
        const operatorAddress = process.env.NEXT_PUBLIC_REDEEM_OPERATOR_ADDRESS
        const settlementAddress = process.env.NEXT_PUBLIC_REDEEM_NFT_SETTLEMENT_ADDRESS
        const junoPtsAddress = process.env.NEXT_PUBLIC_JUNO_PTS_ADDRESS
        const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 96)
        if (!operatorKey || !operatorAddress || !settlementAddress || !junoPtsAddress) {
            return NextResponse.json({ error: 'Redeem NFT settlement is not configured yet' }, { status: 500 })
        }

        const tierIndex: 0 | 1 = item.tier === 'official' ? 0 : 1
        const payoutWallet =
            item.tier === 'registered' && item.payout_wallet ? (item.payout_wallet as `0x${string}`) : ('0x0000000000000000000000000000000000000000' as const)

        const offer: RedeemOffer = {
            itemId: BigInt(item.id),
            operator: operatorAddress as `0x${string}`,
            buyer: wallet as `0x${string}`,
            nftContract: item.nft_contract as `0x${string}`,
            tokenId: BigInt(item.nft_token_id ?? '0'),
            tier: tierIndex,
            payoutWallet,
            legs: [
                { token: junoPtsAddress as `0x${string}`, amount: BigInt(item.price_points) },
                {
                    token: (item.payment_token ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
                    amount: BigInt(item.payment_amount ?? '0'),
                },
                { token: '0x0000000000000000000000000000000000000000', amount: 0n },
            ],
            nonce: BigInt(`0x${randomBytes(16).toString('hex')}`),
            expiry: BigInt(Math.floor(now / 1000) + 15 * 60), // 15 minutes to complete the on-chain tx
        }

        const account = privateKeyToAccount(operatorKey as `0x${string}`)
        const signature = await account.signTypedData({
            domain: redeemOfferDomain(chainId, settlementAddress as `0x${string}`),
            types: REDEEM_OFFER_TYPES,
            primaryType: 'RedeemOffer',
            message: offer,
        })
        const offerHash = computeRedeemOfferHash(offer)

        const { data: order, error } = await supabaseAdmin()
            .from('redemption_orders')
            .insert({ ...baseOrder, offer_hash: offerHash })
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        await logOrderCreated(order.id, wallet, { kind: 'nft', offer_hash: offerHash })

        return NextResponse.json(
            {
                order,
                offer: {
                    itemId: offer.itemId.toString(),
                    operator: offer.operator,
                    buyer: offer.buyer,
                    nftContract: offer.nftContract,
                    tokenId: offer.tokenId.toString(),
                    tier: offer.tier,
                    payoutWallet: offer.payoutWallet,
                    legs: offer.legs.map((l) => ({ token: l.token, amount: l.amount.toString() })),
                    nonce: offer.nonce.toString(),
                    expiry: offer.expiry.toString(),
                },
                signature,
                settlementAddress,
            },
            { status: 201 }
        )
    }

    // kind === 'merch' — STEP 2.2: shipping address is required, with an optional "save on this
    // device" checkbox the frontend implements via localStorage (no server-side address book).
    const shipping = body?.shipping as ShippingInfo | undefined
    if (!shipping?.fullName?.trim() || !shipping?.phone?.trim() || !shipping?.address?.trim()) {
        return NextResponse.json({ error: 'shipping.fullName, phone, and address are required for merch redemptions' }, { status: 400 })
    }

    const escrowListingId = `0x${randomBytes(32).toString('hex')}`
    const officialTreasury = process.env.NEXT_PUBLIC_REDEEM_OFFICIAL_TREASURY_ADDRESS
    const seller = item.tier === 'registered' ? item.payout_wallet : officialTreasury
    if (!seller) {
        return NextResponse.json({ error: 'no payout destination configured for this item' }, { status: 500 })
    }

    const { data: order, error } = await supabaseAdmin()
        .from('redemption_orders')
        .insert({
            ...baseOrder,
            escrow_listing_id: escrowListingId,
            shipping: { fullName: shipping.fullName.trim(), phone: shipping.phone.trim(), address: shipping.address.trim() },
        })
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logOrderCreated(order.id, wallet, { kind: 'merch', escrow_listing_id: escrowListingId })

    return NextResponse.json(
        {
            order,
            escrow: {
                listingId: escrowListingId,
                seller,
                paymentToken: item.payment_token,
                amount: item.payment_amount,
                pricePoints: item.price_points,
            },
        },
        { status: 201 }
    )
}

export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const { data, error } = await supabaseAdmin()
        .from('redemption_orders')
        .select('*, redeem_items(name, image_urls), redeem_item_variants(label)')
        .eq('buyer_wallet', wallet)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json((data ?? []).map(flattenOrderJoin))
}

// Route-level denormalization so the frontend gets item_name/item_image_url/variant_label as flat
// fields (types/redeem.ts's RedemptionOrder) instead of the raw nested join shape.
function flattenOrderJoin<T extends Record<string, unknown>>(row: T) {
    const item = row.redeem_items as { name: string; image_urls: string[] } | null
    const variant = row.redeem_item_variants as { label: string } | null
    const { redeem_items: _items, redeem_item_variants: _variants, ...rest } = row
    return {
        ...rest,
        item_name: item?.name,
        item_image_url: item?.image_urls?.[0] ?? null,
        variant_label: variant?.label ?? null,
    }
}
