import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

async function requireAdmin(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return { error: NextResponse.json({ error: 'not signed in' }, { status: 401 }) }
    if (!(await isAdminOnChain(wallet as `0x${string}`))) {
        return { error: NextResponse.json({ error: 'admin only' }, { status: 403 }) }
    }
    return { wallet }
}

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error

    const status = request.nextUrl.searchParams.get('status') ?? 'open'
    const { data, error } = await supabaseAdmin()
        .from('content_reports')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : null
    const status = body?.status
    if (!id || (status !== 'actioned' && status !== 'dismissed')) {
        return NextResponse.json({ error: 'id and status (actioned|dismissed) are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin()
        .from('content_reports')
        .update({ status, resolved_by: auth.wallet, resolved_at: new Date().toISOString() })
        .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin().from('audit_logs').insert({
        category: 'admin',
        action: `report.${status}`,
        actor_wallet: auth.wallet ?? null,
        actor_type: 'admin',
        subject_type: 'content_report',
        subject_id: id,
        old_status: 'open',
        new_status: status,
        tx_hash: null,
        block_number: null,
        log_index: null,
        request_ip: request.headers.get('x-forwarded-for'),
        user_agent: request.headers.get('user-agent'),
        tg_update_id: null,
        metadata: null,
    })

    return NextResponse.json({ ok: true })
}
