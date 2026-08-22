import { formatUnits } from 'viem'
import { JUNO_PTS_DECIMALS } from '@/types/redeem'
import { findPaymentToken } from '@/lib/tokens'
import type { RedeemItem, RedemptionOrder, ShippingInfo } from '@/types/redeem'

/** Base units -> human-readable Points, shared by every card/detail/order view instead of each
 *  re-deriving formatUnits(..., JUNO_PTS_DECIMALS) inline. */
export function formatPoints(baseUnits: string): string {
    return Number(formatUnits(BigInt(baseUnits), JUNO_PTS_DECIMALS)).toLocaleString()
}

/** Base units -> human-readable token amount, using the chain's known decimals for that address
 *  when available (falls back to the raw base-units string, same behavior as lib/tokens.ts's
 *  formatTokenAmount for an unrecognized token). */
export function formatRedeemTokenAmount(baseUnits: string, chainId: number, tokenAddress: string): string {
    const token = findPaymentToken(chainId, tokenAddress)
    if (!token) return baseUnits
    return Number(formatUnits(BigInt(baseUnits), token.decimals)).toLocaleString()
}

/** The "1,000 PTS + 50 KKUB" price line shared across the catalog card, detail page, and order rows. */
export function redeemPriceLabel(
    row: Pick<RedeemItem | RedemptionOrder, 'price_points' | 'payment_amount' | 'payment_token_symbol'>,
    chainId: number,
    paymentToken: string | null
): string {
    const parts: string[] = []
    if (BigInt(row.price_points || '0') > 0n) parts.push(`${formatPoints(row.price_points)} PTS`)
    if (row.payment_amount && paymentToken && BigInt(row.payment_amount) > 0n) {
        parts.push(`${formatRedeemTokenAmount(row.payment_amount, chainId, paymentToken)} ${row.payment_token_symbol ?? ''}`.trim())
    }
    return parts.join(' + ') || 'Free'
}

/**
 * Renders a shipping address as postable lines. Handles both shapes: the structured fields, and the
 * single free-text `address` that orders placed before the structured form still carry.
 */
export function formatShippingLines(shipping: ShippingInfo): string[] {
    if (!shipping.line1) return shipping.address ? shipping.address.split('\n').filter(Boolean) : []

    const locality = [shipping.district, shipping.province, shipping.postalCode].filter(Boolean).join(' ')
    return [shipping.line1, shipping.line2, locality, shipping.country].filter((line): line is string => Boolean(line))
}
