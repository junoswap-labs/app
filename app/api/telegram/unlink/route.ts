import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const db = supabaseAdmin()
    // Read the chat first so the audit entry records which Telegram account was detached — after
    // the update the column is null and that link is unrecoverable from the row alone.
    const { data: before } = await db
        .from('users')
        .select('telegram_chat_id, telegram_username')
        .eq('wallet_address', wallet)
        .maybeSingle()

    const { error } = await db
        .from('users')
        .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
        .eq('wallet_address', wallet)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (before?.telegram_chat_id) {
        await db.from('audit_logs').insert({
            category: 'bot',
            action: 'telegram.unlinked',
            actor_wallet: wallet,
            actor_type: 'user',
            subject_type: 'user',
            subject_id: wallet,
            old_status: null,
            new_status: null,
            tx_hash: null,
            block_number: null,
            log_index: null,
            tg_update_id: null,
            request_ip: request.headers.get('x-forwarded-for'),
            user_agent: request.headers.get('user-agent'),
            metadata: { chat_id: before.telegram_chat_id, username: before.telegram_username, source: 'settings' },
        })
    }

    return NextResponse.json({ ok: true })
}
