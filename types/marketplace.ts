// Client-side listing — shape matches an nft_orders row (+ denormalized name/imageUrl that the
// optimization plan caches in the DB) so switching mock store → Supabase later barely touches the UI
export type ListingStatus = 'active' | 'sold'

export interface NftListing {
    contract: `0x${string}`
    tokenId: string
    price: string // human-readable amount e.g. "120.5" (mock; real data stores base units)
    paymentToken: string // symbol e.g. "KKUB"
    seller: `0x${string}`
    status: ListingStatus
    listedAt: number // epoch ms
    buyer?: `0x${string}` // set on purchase (mock) — shown in My Orders
    soldAt?: number
    // denormalized metadata (like cached columns in nft_orders) — browse uses this, no chain reads
    name: string
    imageUrl: string | null
}

export type ListingSort = 'recent' | 'price_asc' | 'price_desc'

export interface ListingQuery {
    search: string
    status: ListingStatus | 'all'
    sort: ListingSort
}
