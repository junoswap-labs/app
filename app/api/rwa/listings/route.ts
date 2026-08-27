import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAuthorizedOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import { parseChainId, InvalidChainError } from '@/lib/onchain/request-chain'

// Reads go straight to Supabase from the browser (public-read RLS policy) — this route only
// handles creating a new listing, which needs a live on-chain Authorize check.

export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    if (!(await isAuthorizedOnChain(wallet as `0x${string}`))) {
        return NextResponse.json(
            { error: 'listing RWA items requires the Authorize role — see /app/register' },
            { status: 403 }
        )
    }

    const body = await request.json().catch(() => null)

    let chainId: number
    try {
        chainId = parseChainId(request, body?.chainId)
    } catch (err) {
        if (err instanceof InvalidChainError) return NextResponse.json({ error: err.message }, { status: 400 })
        throw err
    }

    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls.filter((u: unknown) => typeof u === 'string') : []
    const price = typeof body?.price === 'string' ? body.price : String(body?.price ?? '')
    const paymentToken = typeof body?.paymentToken === 'string' ? body.paymentToken : ''

    if (!title || !description || !price || !paymentToken) {
        return NextResponse.json(
            { error: 'title, description, price, and paymentToken are required' },
            { status: 400 }
        )
    }

    // listingId is minted here (not derived from anything on-chain yet) — this is the same value
    // passed as RwaEscrow.fund()'s listingId argument once someone buys, per the contract's comment.
    const listingId = `0x${randomBytes(32).toString('hex')}`

    const { data, error } = await supabaseAdmin()
        .from('rwa_listings')
        .insert({
            id: listingId,
            chain_id: chainId,
            seller_wallet: wallet,
            title,
            description,
            image_urls: imageUrls,
            price,
            payment_token: paymentToken,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
