import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

/** audit_logs has no RLS policy at all (see migration 0002) — service role is the only reader, so
 *  this route is the single way the trail is visible, and it checks the on-chain Admin role first. */
export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
    if (!(await isAdminOnChain(wallet as `0x${string}`))) {
        return NextResponse.json({ error: 'admin only' }, { status: 403 })
    }

    const params = request.nextUrl.searchParams
    const category = params.get('category')
    const subjectId = params.get('subject_id')

    let query = supabaseAdmin().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
    if (category) query = query.eq('category', category)
    if (subjectId) query = query.eq('subject_id', subjectId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
