// Redeem — spend on-chain Points + a payment token for NFTs or merch. Snake_case, matching the DB
// row shape directly (supabase/migrations/0008_redeem_schema.sql / types/supabase.ts) — API routes
// return rows as-is, no camelCase mapping layer, same convention as types/applications.ts.
export type RedeemTier = 'official' | 'registered'
export type RedeemKind = 'nft' | 'merch'
export type RedeemItemStatus = 'draft' | 'published' | 'archived'

/** JunoPts extends OpenZeppelin's ERC20 with the default 18 decimals, no override (contracts/src/JunoPts.sol). */
export const JUNO_PTS_DECIMALS = 18

export interface RedeemItemVariant {
    id: number
    item_id: number
    label: string
    sku: string | null
    stock: number | null
}

export interface RedeemItem {
    id: number
    tier: RedeemTier
    kind: RedeemKind
    lister_wallet: string
    name: string
    description: string
    image_urls: string[]
    price_points: string // base units — JunoPts is an 18-decimal ERC20 like any other
    payment_token: string | null // lowercase ERC20/KAP20 address; null = points-only item
    payment_token_symbol: string | null
    payment_amount: string | null // base units, paired with payment_token
    // Registered tier only — RedeemNftSettlement.RedeemOffer.payoutWallet / the Redeem RwaEscrow
    // deployment's `seller` param. Official items leave this null (proceeds go to the platform).
    payout_wallet: string | null
    // NFT kind only — settles through RedeemNftSettlement.redeem(). Registered-tier NFTs must
    // already be deposited into that contract's `treasury` address (+ approved) before the listing
    // can publish; see app/api/redeem/items for the enforcement.
    nft_contract: string | null
    nft_token_id: string | null
    // Only meaningful when the item has no variant rows — an item with variants tracks stock
    // per-variant instead (see `variants` below).
    stock: number | null
    variants?: RedeemItemVariant[]
    publish_at: string | null
    redeem_start_at: string | null
    redeem_end_at: string | null
    status: RedeemItemStatus
    created_at: string
}

export interface ShippingInfo {
    fullName: string
    phone: string
    address: string
}

// 'PendingPayment' is written by the order-creation Route Handler, before the buyer's wallet has
// actually sent the on-chain tx — same reasoning rwa_listings (pre-funding) is split from
// rwa_orders (post-funding) in supabase/migrations/0001_base_schema.sql, just folded into one
// table here since a redemption order has no separate "still just a listing" phase. Every other
// status is written ONLY by the sync poller, never by the API route, per the Clean Workflow rule.
//
// NFT kind settles atomically via RedeemNftSettlement.redeem() — 'PendingPayment' -> 'Completed'
// is the only transition it ever makes, driven by the NftRedeemed event. Merch kind reuses
// RwaEscrow.sol directly (a second deployment dedicated to Redeem — see .env.example's
// NEXT_PUBLIC_REDEEM_RWA_ESCROW_ADDRESS) so from 'Funded' onward its status mirrors that contract's
// own Status enum exactly, same reasoning as rwa_orders.status in 0001_base_schema.sql. Ship
// deadline / dispute grace / auto-release constants live on types/rwa.ts — this deployment reuses
// those same defaults (see contracts/script/DeployRwaEscrow.s.sol).
export type RedemptionStatus =
    | 'PendingPayment'
    | 'Funded'
    | 'Shipped'
    | 'Completed'
    | 'Refunded'
    | 'Disputed'
    | 'ResolvedSeller'
    | 'ResolvedBuyer'

export interface RedemptionOrder {
    id: string
    item_id: number
    variant_id: number | null
    buyer_wallet: string
    tier: RedeemTier
    kind: RedeemKind
    price_points: string
    payment_token: string | null
    payment_token_symbol: string | null
    payment_amount: string | null
    offer_hash: string | null // NFT kind — RedeemNftSettlement.hashOffer(offer)
    escrow_listing_id: string | null // merch kind — the Redeem RwaEscrow fund() listingId
    status: RedemptionStatus
    shipping: ShippingInfo | null
    tracking_number: string | null
    created_at: string
    updated_at: string
    shipped_at: string | null
    completed_at: string | null
    resolved_at: string | null
    // Denormalized by the Route Handler's join (redeem_items.name/image_urls) — not DB columns on
    // this table.
    item_name?: string
    item_image_url?: string | null
    variant_label?: string | null
}
