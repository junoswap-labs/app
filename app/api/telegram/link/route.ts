import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Called by the standalone Telegram bot service (telegram-bot-app repo), not by Telegram itself —
 * the bot long-polls getUpdates and forwards a `/start <code>` here so every pairing rule, dedup,
 * and audit write stays in one place next to the database.
 *
 * POST links a chat to the wallet that generated the code; DELETE unlinks whatever wallet the chat
 * is paired with (the bot's /unlink command). Both reply with `message`, which the bot sends back
 * to the user verbatim.
 */
function authorized(request: NextRequest): boolean {
    const expected = process.env.TELEGRAM_BOT_SERVICE_SECRET
    const given = request.headers.get('x-bot-secret')
    if (!expected || !given) return false
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

interface AuditInput {
    action: string
    wallet: string | null
    updateId: number | null
    metadata: Record<string, unknown>
}

async function audit({ action, wallet, updateId, metadata }: AuditInput) {
    // 23505 = the bot re-delivered an update already recorded (tg_update_id's dedup index) —
    // expected on a retry, not worth failing the request over.
    await supabaseAdmin().from('audit_logs').insert({
        category: 'bot',
        action,
        actor_wallet: wallet,
        actor_type: 'system',
        subject_type: 'user',
        subject_id: wallet,
        old_status: null,
        new_status: null,
        tx_hash: null,
        block_number: null,
        log_index: null,
        request_ip: null,
        user_agent: null,
        tg_update_id: updateId != null ? String(updateId) : null,
        metadata,
    })
}

export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const code = typeof body?.code === 'string' ? body.code : null
    const chatId = body?.chatId != null ? String(body.chatId) : null
    const username = typeof body?.username === 'string' ? body.username : null
    const updateId = typeof body?.updateId === 'number' ? body.updateId : null
    if (!code || !chatId) return NextResponse.json({ error: 'code and chatId are required' }, { status: 400 })

    const db = supabaseAdmin()
    const { data: user } = await db
        .from('users')
        .select('wallet_address, telegram_chat_id, telegram_link_code_expires_at')
        .eq('telegram_link_code', code)
        .maybeSingle()

    if (!user?.telegram_link_code_expires_at || Date.now() > new Date(user.telegram_link_code_expires_at).getTime()) {
        return NextResponse.json({
            ok: false,
            message: 'That link code is invalid or has expired. Open Settings on the site and tap Connect Telegram again.',
        })
    }

    // Refuse a second wallet on the same Telegram account. Migration 0013's unique index rejects it
    // at the DB level anyway; checking here is what lets the user see why.
    const { data: existing } = await db
        .from('users')
        .select('wallet_address')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()

    if (existing && existing.wallet_address !== user.wallet_address) {
        await audit({
            action: 'telegram.link_rejected',
            wallet: user.wallet_address,
            updateId,
            metadata: { chat_id: chatId, reason: 'chat_already_linked', linked_wallet: existing.wallet_address },
        })
        return NextResponse.json({
            ok: false,
            message: 'This Telegram account is already connected to another wallet. Disconnect it there first, or send /unlink here.',
        })
    }

    if (existing) return NextResponse.json({ ok: true, message: 'This wallet is already connected. You are all set.' })

    const { error } = await db
        .from('users')
        .update({
            telegram_chat_id: chatId,
            telegram_username: username,
            telegram_linked_at: new Date().toISOString(),
            telegram_link_code: null,
            telegram_link_code_expires_at: null,
        })
        .eq('wallet_address', user.wallet_address)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await audit({ action: 'telegram.linked', wallet: user.wallet_address, updateId, metadata: { chat_id: chatId, username } })

    return NextResponse.json({
        ok: true,
        message: `Connected to wallet ${user.wallet_address.slice(0, 6)}…${user.wallet_address.slice(-4)}. Order and airdrop alerts will arrive here.`,
    })
}

export async function DELETE(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const chatId = body?.chatId != null ? String(body.chatId) : null
    const updateId = typeof body?.updateId === 'number' ? body.updateId : null
    if (!chatId) return NextResponse.json({ error: 'chatId is required' }, { status: 400 })

    const db = supabaseAdmin()
    const { data: user } = await db.from('users').select('wallet_address').eq('telegram_chat_id', chatId).maybeSingle()
    if (!user) return NextResponse.json({ ok: false, message: 'This Telegram account is not connected to any wallet.' })

    const { error } = await db
        .from('users')
        .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
        .eq('wallet_address', user.wallet_address)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await audit({ action: 'telegram.unlinked', wallet: user.wallet_address, updateId, metadata: { chat_id: chatId, source: 'bot' } })

    return NextResponse.json({ ok: true, message: 'Disconnected. Alerts will stop.' })
}
