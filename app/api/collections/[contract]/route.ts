import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

/** Admin-only: verify/unverify or retroactively deactivate a registered collection. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ contract: string }> }) {
    const { contract } = await params
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
    if (!(await isAdminOnChain(wallet as `0x${string}`))) {
        return NextResponse.json({ error: 'not an admin' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const patch: { verified?: boolean; active?: boolean } = {}
    if (typeof body?.verified === 'boolean') patch.verified = body.verified
    if (typeof body?.active === 'boolean') patch.active = body.active
    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'verified and/or active are required' }, { status: 400 })
    }

    const chainId = Number(request.nextUrl.searchParams.get('chainId'))
    if (!chainId) return NextResponse.json({ error: 'chainId query param is required' }, { status: 400 })

    const { data, error } = await supabaseAdmin()
        .from('collections')
        .update(patch)
        .eq('contract', contract.toLowerCase())
        .eq('chain_id', chainId)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
