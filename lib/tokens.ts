import { formatUnits } from 'viem'
import { bitkub, kubTestnet } from '@/lib/wagmi'

export interface PaymentToken {
    symbol: string
    address: `0x${string}`
    decimals: number
}

// Real, verified ERC20 addresses only — an unverified/guessed address here would send funds to
// the wrong contract. Extend this list once more payment tokens' real addresses are confirmed
// (each token also needs NftMarketplace.setAllowedPaymentToken / RwaEscrow.setAllowedPaymentToken
// called on-chain before it's actually usable, independent of this registry).
export const PAYMENT_TOKENS: Record<number, PaymentToken[]> = {
    [bitkub.id]: [{ symbol: 'KKUB', address: '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5', decimals: 18 }],
    [kubTestnet.id]: [],
}

export function getPaymentTokens(chainId: number): PaymentToken[] {
    return PAYMENT_TOKENS[chainId] ?? []
}

export function findPaymentToken(chainId: number, address: string): PaymentToken | undefined {
    return getPaymentTokens(chainId).find((t) => t.address.toLowerCase() === address.toLowerCase())
}

/** Base units (as stored on-chain/in the DB) → {amount, symbol} for display. */
export function formatTokenAmount(
    baseUnits: string,
    chainId: number,
    tokenAddress: string
): { amount: string; symbol: string } {
    const token = findPaymentToken(chainId, tokenAddress)
    if (!token) return { amount: baseUnits, symbol: `${tokenAddress.slice(0, 6)}…` }
    return { amount: formatUnits(BigInt(baseUnits), token.decimals), symbol: token.symbol }
}
