import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

// Hand-rolled HMAC-signed cookie tokens (no session-store dependency needed): payload is
// base64url JSON, signature is HMAC-SHA256 over the payload, both required to accept a cookie.
// SESSION_SECRET must be set server-side (see .env.example) — verification throws without it
// rather than silently accepting unsigned/forgeable sessions.

export const SESSION_COOKIE = 'juno_session'
export const NONCE_COOKIE = 'juno_siwe_nonce'
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
export const NONCE_TTL_SECONDS = 5 * 60

interface SessionPayload {
    wallet: string
    exp: number
}

interface NoncePayload {
    nonce: string
    exp: number
}

function secret(): string {
    const s = process.env.SESSION_SECRET
    if (!s) throw new Error('SESSION_SECRET is not set')
    return s
}

function sign(payload: string): string {
    return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function pack(data: Record<string, unknown>): string {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
    return `${payload}.${sign(payload)}`
}

function unpack<T>(token: string): T | null {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null
    const expected = sign(payload)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    // timingSafeEqual throws on length mismatch — check first so an invalid token 400s, not 500s
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    try {
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
    } catch {
        return null
    }
}

export function createSessionToken(wallet: string): string {
    return pack({ wallet: wallet.toLowerCase(), exp: Date.now() + SESSION_TTL_SECONDS * 1000 })
}

export function verifySessionToken(token: string): { wallet: string } | null {
    const data = unpack<SessionPayload>(token)
    if (!data || Date.now() > data.exp) return null
    return { wallet: data.wallet }
}

/** Never trust a client-supplied wallet address — this is the only legitimate source. */
export function getSessionWallet(request: NextRequest): string | null {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    if (!token) return null
    return verifySessionToken(token)?.wallet ?? null
}

export function createNonceToken(): { nonce: string; token: string } {
    const nonce = randomBytes(16).toString('hex')
    const token = pack({ nonce, exp: Date.now() + NONCE_TTL_SECONDS * 1000 })
    return { nonce, token }
}

export function verifyNonceToken(token: string, expectedNonce: string): boolean {
    const data = unpack<NoncePayload>(token)
    if (!data || Date.now() > data.exp) return false
    return data.nonce === expectedNonce
}
