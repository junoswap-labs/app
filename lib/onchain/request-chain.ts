import type { NextRequest } from 'next/server'
import { isSupportedChainId } from '@/config/contract-addresses'

/** Thrown when a request doesn't name a valid, supported chain. Route Handlers catch it and
 *  return 400 — the server has no wallet, so the chain must come from the caller. */
export class InvalidChainError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidChainError'
    }
}

/**
 * Resolves the chain a Route Handler should act on: `?chainId=` for GETs, a `chainId` field in the
 * parsed JSON body for POST/PATCH (pass it as `bodyChainId`). Validated against the chains this
 * deployment actually serves (config/contract-addresses.ts).
 */
export function parseChainId(request: NextRequest, bodyChainId?: unknown): number {
    const raw = bodyChainId ?? request.nextUrl.searchParams.get('chainId')
    if (raw == null || raw === '') throw new InvalidChainError('missing chainId')
    const chainId = Number(raw)
    if (!Number.isInteger(chainId) || !isSupportedChainId(chainId)) {
        throw new InvalidChainError(`unsupported chainId: ${String(raw)}`)
    }
    return chainId
}
