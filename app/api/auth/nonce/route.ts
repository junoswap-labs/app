import { NextResponse } from 'next/server'
import { createNonceToken, NONCE_COOKIE, NONCE_TTL_SECONDS } from '@/lib/auth/session'

export async function GET() {
    const { nonce, token } = createNonceToken()
    const res = NextResponse.json({ nonce })
    res.cookies.set(NONCE_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: NONCE_TTL_SECONDS,
        path: '/',
    })
    return res
}
