// RWA escrow order — shape matches the planned rwa_listings row + contract states
// (see Docs/smartcontract-plan.md / backend-plan.md) so swapping mock → Supabase is mechanical.
export type RwaStatus =
    | 'listed' // off-chain listing, no escrow yet (no gas until someone buys)
    | 'funded' // buyer escrowed payment via fund()
    | 'shipped' // seller called markShipped()
    | 'completed' // buyer confirmed — escrow released to seller
    | 'refunded' // buyer reclaimed after ship deadline passed
    | 'disputed' // openDispute() after receive deadline
    | 'resolved' // arbitrator decided via resolveDispute()
    | 'cancelled' // seller delisted before funding

export interface RwaListing {
    id: string
    title: string
    description: string
    imageUrls: string[]
    price: string // human-readable (mock; real data stores base units)
    paymentToken: string
    seller: `0x${string}`
    buyer?: `0x${string}`
    status: RwaStatus
    createdAt: number
    fundedAt?: number
    shippedAt?: number
    /** set by resolveDispute — true = released to seller, false = refunded to buyer */
    resolvedToSeller?: boolean
}

/** Contract constants mirrored client-side for UX countdowns only — contract enforces for real */
export const SHIP_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000
export const RECEIVE_DEADLINE_MS = 14 * 24 * 60 * 60 * 1000

export type RwaAction =
    | 'fund'
    | 'markShipped'
    | 'confirmReceived'
    | 'claimRefund'
    | 'openDispute'
    | 'resolveDispute'
    | 'cancel'
