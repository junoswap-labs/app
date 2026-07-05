// Redeem — spend on-chain Points + a payment token for NFTs or merch.
// Catalog is split into two tiers: 'official' (official token) and
// 'registered' (community tokens registered with the system).
export type RedeemTier = 'official' | 'registered'
export type RedeemKind = 'nft' | 'merch'

export interface RedeemItem {
    id: string
    tier: RedeemTier
    kind: RedeemKind
    name: string
    description: string
    imageUrl?: string
    pricePoints: number
    priceToken: number
    /** ERC20 symbol the item is priced in */
    tokenSymbol: string
    /** Remaining redeemable stock; null = unlimited */
    stock: number | null
}

export interface ShippingInfo {
    fullName: string
    phone: string
    address: string
}

// Token ↔ NFT settles fully on-chain, but Token ↔ RWA (merch) needs stored order
// data and an admin verification step before anything ships. Status is written by
// the backend/poller only — same clean-workflow rule as marketplace orders.
export type RedemptionStatus =
    | 'submitted' // paid, waiting for admin to verify payment + shipping data
    | 'verified' // admin confirmed — preparing shipment
    | 'shipped' // on its way (tracking number attached)
    | 'completed' // NFT delivered on-chain, or merch confirmed received
    | 'rejected' // verification failed — refund flow

export interface RedemptionOrder {
    id: string
    itemId: string
    itemName: string
    kind: RedeemKind
    tier: RedeemTier
    pricePoints: number
    priceToken: number
    tokenSymbol: string
    status: RedemptionStatus
    shipping?: ShippingInfo
    trackingNumber?: string
    createdAt: number
    updatedAt: number
}
