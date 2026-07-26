import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { ApplicationKind } from '@/types/applications'

const VALID_KINDS: ApplicationKind[] = ['authorize_rwa', 'partner_marketplace', 'partner_redeem']

export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const kind = request.nextUrl.searchParams.get('kind') as ApplicationKind | null
    let query = supabaseAdmin().from('applications').select('*').eq('wallet_address', wallet)
    if (kind) query = query.eq('kind', kind)

    const { data, error } = await query.order('submitted_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const kind: ApplicationKind | undefined = body?.kind
    const payload = body?.payload
    if (!kind || !VALID_KINDS.includes(kind) || typeof payload !== 'object' || payload === null) {
        return NextResponse.json({ error: 'kind and payload are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin()
        .from('applications')
        .insert({ wallet_address: wallet, kind, payload })
        .select()
        .single()

    if (error) {
        // applications_one_pending_idx unique violation — already have a pending application of this kind
        if (error.code === '23505') {
            return NextResponse.json(
                { error: 'a pending application of this kind already exists' },
                { status: 409 }
            )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
}
