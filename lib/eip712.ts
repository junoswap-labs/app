import { encodeAbiParameters, keccak256 } from 'viem'
import type { Address } from 'viem'

// Mirrors contracts/src/NftMarketplace.sol's Order struct/typehash exactly — field order and
// types must match or signatures won't verify (see the contract's own comment on this).
export interface NftOrder {
    seller: Address
    nftContract: Address
    tokenId: bigint
    paymentToken: Address
    price: bigint
    nonce: bigint
    expiry: bigint
}

export function nftOrderDomain(chainId: number, verifyingContract: Address) {
    return { name: 'JunoswapMarketplace', version: '1', chainId, verifyingContract } as const
}

export const NFT_ORDER_TYPES = {
    Order: [
        { name: 'seller', type: 'address' },
        { name: 'nftContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'paymentToken', type: 'address' },
        { name: 'price', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ],
} as const

/**
 * Matches NftMarketplace.sol's `hashOrder()` = keccak256(abi.encode(order)) exactly — the
 * canonical order id (order_hash primary key), NOT the EIP-712 digest the seller signs. Computed
 * locally (no RPC call needed) so the API route can verify a submitted order_hash independently.
 */
export function computeNftOrderHash(order: NftOrder): `0x${string}` {
    return keccak256(
        encodeAbiParameters(
            [
                { type: 'address' },
                { type: 'address' },
                { type: 'uint256' },
                { type: 'address' },
                { type: 'uint256' },
                { type: 'uint256' },
                { type: 'uint256' },
            ],
            [
                order.seller,
                order.nftContract,
                order.tokenId,
                order.paymentToken,
                order.price,
                order.nonce,
                order.expiry,
            ]
        )
    )
}

// Mirrors contracts/src/RedeemNftSettlement.sol's RedeemOffer struct/typehash exactly.
export interface RedeemPriceLeg {
    token: Address
    amount: bigint
}

export interface RedeemOffer {
    itemId: bigint
    operator: Address
    buyer: Address
    nftContract: Address
    tokenId: bigint
    tier: 0 | 1 // RedeemNftSettlement.Tier: 0 = Official, 1 = Registered
    payoutWallet: Address // must be the zero address for tier === 0 (Official) — contract enforces this
    legs: [RedeemPriceLeg, RedeemPriceLeg, RedeemPriceLeg]
    nonce: bigint
    expiry: bigint
}

export function redeemOfferDomain(chainId: number, verifyingContract: Address) {
    return { name: 'JunoRedeemNftSettlement', version: '1', chainId, verifyingContract } as const
}

export const REDEEM_OFFER_TYPES = {
    PriceLeg: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
    ],
    RedeemOffer: [
        { name: 'itemId', type: 'uint256' },
        { name: 'operator', type: 'address' },
        { name: 'buyer', type: 'address' },
        { name: 'nftContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'tier', type: 'uint8' },
        { name: 'payoutWallet', type: 'address' },
        { name: 'legs', type: 'PriceLeg[3]' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ],
} as const

// Mirrors contracts/src/AirdropEscrow.sol's ClaimAuthorization struct/typehash exactly.
export interface AirdropClaimAuthorization {
    campaignId: `0x${string}`
    recipient: Address
    amount: bigint
    deadline: bigint
}

export function airdropClaimDomain(chainId: number, verifyingContract: Address) {
    return { name: 'JunoAirdropEscrow', version: '1', chainId, verifyingContract } as const
}

export const AIRDROP_CLAIM_TYPES = {
    ClaimAuthorization: [
        { name: 'campaignId', type: 'bytes32' },
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
    ],
} as const

/** Matches RedeemNftSettlement.sol's `hashOffer()` = keccak256(abi.encode(offer)) exactly — the
 *  canonical offer id (offer_hash column), NOT the EIP-712 digest the operator signs. */
export function computeRedeemOfferHash(offer: RedeemOffer): `0x${string}` {
    return keccak256(
        encodeAbiParameters(
            [
                { type: 'uint256' },
                { type: 'address' },
                { type: 'address' },
                { type: 'address' },
                { type: 'uint256' },
                { type: 'uint8' },
                { type: 'address' },
                { type: 'address' },
                { type: 'uint256' },
                { type: 'address' },
                { type: 'uint256' },
                { type: 'address' },
                { type: 'uint256' },
                { type: 'uint256' },
                { type: 'uint256' },
            ],
            [
                offer.itemId,
                offer.operator,
                offer.buyer,
                offer.nftContract,
                offer.tokenId,
                offer.tier,
                offer.payoutWallet,
                offer.legs[0].token,
                offer.legs[0].amount,
                offer.legs[1].token,
                offer.legs[1].amount,
                offer.legs[2].token,
                offer.legs[2].amount,
                offer.nonce,
                offer.expiry,
            ]
        )
    )
}
