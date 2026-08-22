import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'

const LINK_CODE_TTL_MS = 10 * 60 * 1000

/** Connect Telegram button -> here -> opens the t.me deep link -> user taps Start in Telegram ->
 *  app/api/telegram/webhook pairs chat_id -> the settings card polls GET /api/me until it shows up. */
export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const botUsername = process.env.TELEGRAM_BOT_USERNAME
    if (!botUsername) {
        return NextResponse.json({ error: 'Telegram bot is not configured yet — see .env.example' }, { status: 500 })
    }

    const code = randomBytes(12).toString('hex')
    const { error } = await supabaseAdmin()
        .from('users')
        .update({
            telegram_link_code: code,
            telegram_link_code_expires_at: new Date(Date.now() + LINK_CODE_TTL_MS).toISOString(),
        })
        .eq('wallet_address', wallet)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        deepLink: `https://t.me/${botUsername}?start=${code}`,
        expiresInSeconds: LINK_CODE_TTL_MS / 1000,
    })
}
