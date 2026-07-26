// Client-side listing shape — mapped from a real nft_orders row (hooks/useListings.ts's
// mapNftOrderRow) into human-readable price/symbol so display components never touch base
// units/token addresses directly; denormalized name/imageUrl are cached columns, no chain reads.
export type ListingStatus = 'active' | 'sold'

export interface NftListing {
    /** NftMarketplace.sol's hashOrder(order) — the nft_orders primary key and route param. */
    orderHash: `0x${string}`
    contract: `0x${string}`
    tokenId: string
    price: string // human-readable, already formatted by token decimals
    paymentToken: string // symbol, e.g. "KKUB" — reverse-looked-up from the ERC20 address via lib/tokens.ts
    seller: `0x${string}`
    status: ListingStatus
    listedAt: number // epoch ms
    buyer?: `0x${string}`
    soldAt?: number
    name: string
    imageUrl: string | null
}

export type ListingSort = 'recent' | 'price_asc' | 'price_desc'

export interface ListingQuery {
    search: string
    status: ListingStatus | 'all'
    sort: ListingSort
    /** Restrict to one NFT contract — powers the per-collection browse page. */
    contract?: `0x${string}`
}
