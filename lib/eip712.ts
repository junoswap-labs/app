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
