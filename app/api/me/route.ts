import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json(null, { status: 401 })

    const { data } = await supabaseAdmin()
        .from('users')
        .select('google_email, telegram_chat_id, telegram_username, notify_new_offer, notify_deadline')
        .eq('wallet_address', wallet)
        .maybeSingle()

    return NextResponse.json({
        wallet_address: wallet,
        google_email: data?.google_email ?? null,
        telegram_chat_id: data?.telegram_chat_id ?? null,
        telegram_username: data?.telegram_username ?? null,
        notify_new_offer: data?.notify_new_offer ?? true,
        notify_deadline: data?.notify_deadline ?? true,
    })
}

/** Notification-preference toggles on the Settings page — the only fields on this row a user can
 *  self-serve edit directly (Google/Telegram linking go through their own dedicated routes). */
export async function PATCH(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const update: { notify_new_offer?: boolean; notify_deadline?: boolean } = {}
    if (typeof body?.notify_new_offer === 'boolean') update.notify_new_offer = body.notify_new_offer
    if (typeof body?.notify_deadline === 'boolean') update.notify_deadline = body.notify_deadline
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'notify_new_offer and/or notify_deadline (boolean) required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin().from('users').upsert({ wallet_address: wallet, ...update }, { onConflict: 'wallet_address' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
