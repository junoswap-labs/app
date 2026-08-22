import { NextRequest, NextResponse } from 'next/server'
import { SiweMessage } from 'siwe'
import {
    NONCE_COOKIE,
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    createSessionToken,
    verifyNonceToken,
} from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null)
    const { message, signature } = body ?? {}
    if (typeof message !== 'string' || typeof signature !== 'string') {
        return NextResponse.json({ error: 'message and signature are required' }, { status: 400 })
    }

    const nonceToken = request.cookies.get(NONCE_COOKIE)?.value
    if (!nonceToken) {
        return NextResponse.json(
            { error: 'no pending sign-in — request a nonce first' },
            { status: 400 }
        )
    }

    let siwe: SiweMessage
    try {
        siwe = new SiweMessage(message)
    } catch {
        return NextResponse.json({ error: 'malformed SIWE message' }, { status: 400 })
    }

    if (!verifyNonceToken(nonceToken, siwe.nonce)) {
        return NextResponse.json(
            { error: 'nonce expired or mismatched — request a new one' },
            { status: 400 }
        )
    }

    const result = await siwe.verify({ signature, nonce: siwe.nonce }, { suppressExceptions: true })
    if (!result.success) {
        return NextResponse.json(
            { error: result.error?.type ?? 'signature verification failed' },
            { status: 401 }
        )
    }

    const wallet = result.data.address.toLowerCase()
    const { error: userError } = await supabaseAdmin()
        .from('users')
        .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true })
    // Every other table's wallet columns FK-reference users(wallet_address) — a session cookie must
    // never be issued without this row existing, or every later write 500s on the FK constraint.
    if (userError) return NextResponse.json({ error: 'could not create user record' }, { status: 500 })

    const res = NextResponse.json({ wallet_address: wallet })
    res.cookies.set(SESSION_COOKIE, createSessionToken(wallet), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_TTL_SECONDS,
        path: '/',
    })
    res.cookies.delete(NONCE_COOKIE)
    return res
}
