// Types match the analytics views in supabase/migrations/0003_admin_role_and_analytics.sql
// Postgres numeric columns are serialized as strings over JSON — keep as string, format on display
// (values are token base units; per-token decimals formatting happens at render time)

export interface AnalyticsOverview {
    total_items_sold: number
    nft_items_sold: number
    rwa_items_sold: number
    active_nft_listings: number
    active_rwa_listings: number
    total_users: number
    rwa_funded: number
    rwa_shipped: number
    rwa_refunded: number
    open_disputes: number
}

export interface SalesByToken {
    token: string
    nft_items: number
    rwa_items: number
    total_items: number
    nft_volume: string
    rwa_volume: string
    total_volume: string
    nft_fee: string
    rwa_fee: string
    total_fee: string
}

export interface DailySalesRow {
    day: string // YYYY-MM-DD
    source: 'nft' | 'rwa'
    token: string
    items: number
    volume: string
    fee: string
}

export interface TopSellerRow {
    wallet: string
    token: string
    items: number
    volume: string
    fee: string
}

export interface TopCollectionRow {
    nft_contract: string
    token: string
    items: number
    volume: string
    fee: string
}

export interface AnalyticsResponse {
    overview: AnalyticsOverview
    byToken: SalesByToken[]
    dailySales: DailySalesRow[]
    topSellers: TopSellerRow[]
    topCollections: TopCollectionRow[]
    selectedToken: string | null
}

// Admin/Partner/Authorize are NOT part of this response — they're read live from
// PermissionRegistry.sol on-chain (see contracts/), not the session/DB. See hooks/useCurrentUser.ts.
export interface MeResponse {
    wallet_address: string
    google_email: string | null
    telegram_chat_id: string | null
    telegram_username: string | null
    notify_new_offer: boolean
    notify_deadline: boolean
}
