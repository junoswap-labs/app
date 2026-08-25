/**
 * Validates/normalizes a base-units token amount (e.g. an 18-decimal ERC20 or JunoPts value)
 * coming from a request body. Base units routinely exceed Number.MAX_SAFE_INTEGER, so this stays
 * on BigInt/string throughout rather than round-tripping through Number — same convention as
 * nft_orders.price / rwa_orders.amount elsewhere in this codebase.
 */
export function parseBaseUnitsAmount(value: unknown): string | null {
    if (value == null) return null
    const str = typeof value === 'bigint' ? value.toString() : String(value).trim()
    if (!/^\d+$/.test(str)) return null
    try {
        return BigInt(str).toString() // round-trips through BigInt to strip leading zeros etc.
    } catch {
        return null
    }
}
