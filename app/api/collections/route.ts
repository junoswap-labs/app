import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain, isPartnerMarketplaceOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

// Reads go straight to Supabase from the browser (public-read RLS policy, see
// supabase/migrations/0006_collections.sql) — no API route needed for GET. This route only
// handles registering a new collection, which needs a live on-chain role check.

export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const address = wallet as `0x${string}`
    const [admin, partner] = await Promise.all([isAdminOnChain(address), isPartnerMarketplaceOnChain(address)])
    if (!admin && !partner) {
        return NextResponse.json(
            { error: 'registering a collection requires Admin or Marketplace Partner rights' },
            { status: 403 }
        )
    }

    const body = await request.json().catch(() => null)
    const contract = typeof body?.contract === 'string' ? body.contract.toLowerCase() : null
    const chainId = Number(body?.chainId)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!contract || !/^0x[a-f0-9]{40}$/.test(contract) || !chainId || !name) {
        return NextResponse.json({ error: 'contract, chainId, and name are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin()
        .from('collections')
        .insert({
            contract,
            chain_id: chainId,
            name,
            display_name: typeof body?.displayName === 'string' ? body.displayName.trim() : null,
            gateway: typeof body?.gateway === 'string' ? body.gateway.trim() : null,
            registered_by: wallet,
            metadata: null,
            // Admin registrations start verified; partner self-serve ones don't until reviewed.
            verified: admin,
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'this collection is already registered' }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
}
