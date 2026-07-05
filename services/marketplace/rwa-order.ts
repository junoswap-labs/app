import {
    SHIP_DEADLINE_MS,
    RECEIVE_DEADLINE_MS,
    type RwaAction,
    type RwaListing,
} from '@/types/rwa'

export type RwaRole = 'buyer' | 'seller' | 'arbitrator' | 'other'

export function roleFor(listing: RwaListing, wallet?: string, isArbitrator = false): RwaRole {
    if (isArbitrator) return 'arbitrator'
    if (!wallet) return 'other'
    const w = wallet.toLowerCase()
    if (listing.seller.toLowerCase() === w) return 'seller'
    if (listing.buyer?.toLowerCase() === w) return 'buyer'
    return 'other'
}

/**
 * Client-side state-machine guard — UX only (disable buttons that would revert).
 * The contract's require/modifiers are the real source of truth; never relax those
 * because this returned true.
 */
export function canPerform(
    listing: RwaListing,
    action: RwaAction,
    role: RwaRole,
    now: number = Date.now()
): boolean {
    switch (action) {
        case 'fund':
            // anyone except the seller can fund an open listing
            return listing.status === 'listed' && role !== 'seller'
        case 'cancel':
            return listing.status === 'listed' && role === 'seller'
        case 'markShipped':
            return listing.status === 'funded' && role === 'seller'
        case 'confirmReceived':
            return listing.status === 'shipped' && role === 'buyer'
        case 'claimRefund':
            // ship deadline passed without the seller shipping
            return (
                listing.status === 'funded' &&
                role === 'buyer' &&
                listing.fundedAt !== undefined &&
                now >= listing.fundedAt + SHIP_DEADLINE_MS
            )
        case 'openDispute':
            // receive deadline passed while shipped — either party may escalate
            return (
                listing.status === 'shipped' &&
                (role === 'buyer' || role === 'seller') &&
                listing.shippedAt !== undefined &&
                now >= listing.shippedAt + RECEIVE_DEADLINE_MS
            )
        case 'resolveDispute':
            return listing.status === 'disputed' && role === 'arbitrator'
        default:
            return false
    }
}
