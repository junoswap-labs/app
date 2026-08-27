import { NextRequest, NextResponse } from 'next/server'
import { recoverTypedDataAddress } from 'viem'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'
import { NFT_ORDER_TYPES, computeNftOrderHash, nftOrderDomain, type NftOrder } from '@/lib/eip712'
import { isSupportedChainId } from '@/config/contract-addresses'

// Reads go straight to Supabase from the browser (public-read RLS policy, see
// supabase/migrations/0001_base_schema.sql) — this route only handles creating a new listing,
// which needs signature verification + a live collection-registered check.

export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const { order, signature, chainId, verifyingContract, name, imageUrl } = body ?? {}
    if (!order || typeof signature !== 'string' || !chainId || !verifyingContract) {
        return NextResponse.json(
            { error: 'order, signature, chainId, and verifyingContract are required' },
            { status: 400 }
        )
    }
    if (!isSupportedChainId(Number(chainId))) {
        return NextResponse.json({ error: `unsupported chainId: ${String(chainId)}` }, { status: 400 })
    }

    let nftOrder: NftOrder
    try {
        nftOrder = {
            seller: order.seller,
            nftContract: order.nftContract,
            tokenId: BigInt(order.tokenId),
            paymentToken: order.paymentToken,
            price: BigInt(order.price),
            nonce: BigInt(order.nonce),
            expiry: BigInt(order.expiry),
        }
    } catch {
        return NextResponse.json({ error: 'malformed order' }, { status: 400 })
    }

    if (nftOrder.seller.toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json({ error: 'order.seller must be the signed-in wallet' }, { status: 403 })
    }

    const recovered = await recoverTypedDataAddress({
        domain: nftOrderDomain(Number(chainId), verifyingContract),
        types: NFT_ORDER_TYPES,
        primaryType: 'Order',
        message: nftOrder,
        signature: signature as `0x${string}`,
    }).catch(() => null)

    if (!recovered || recovered.toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json({ error: 'signature does not match order.seller' }, { status: 400 })
    }

    const { data: collection } = await supabaseAdmin()
        .from('collections')
        .select('contract')
        .eq('contract', nftOrder.nftContract.toLowerCase())
        .eq('chain_id', Number(chainId))
        .eq('active', true)
        .maybeSingle()

    if (!collection) {
        return NextResponse.json(
            { error: 'this collection is not registered — register it before listing' },
            { status: 403 }
        )
    }

    const orderHash = computeNftOrderHash(nftOrder)

    const { data, error } = await supabaseAdmin()
        .from('nft_orders')
        .insert({
            order_hash: orderHash,
            chain_id: Number(chainId),
            seller: wallet,
            nft_contract: nftOrder.nftContract.toLowerCase(),
            token_id: nftOrder.tokenId.toString(),
            payment_token: nftOrder.paymentToken.toLowerCase(),
            price: nftOrder.price.toString(),
            nonce: nftOrder.nonce.toString(),
            expiry: Number(nftOrder.expiry),
            signature,
            name: typeof name === 'string' && name.trim() ? name.trim() : null,
            image_url: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null,
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'this exact order already exists' }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
}
