// Display-only fee math — the contract computes the authoritative amounts.
export const MARKETPLACE_FEE_BPS = 200 // 2%

export interface FeeBreakdown {
    price: number
    fee: number
    sellerReceives: number
}

export function feeBreakdown(price: string | number, feeBps: number = MARKETPLACE_FEE_BPS): FeeBreakdown {
    const p = typeof price === 'string' ? Number(price) : price
    if (!Number.isFinite(p) || p < 0) return { price: 0, fee: 0, sellerReceives: 0 }
    const fee = (p * feeBps) / 10_000
    return { price: p, fee, sellerReceives: p - fee }
}
