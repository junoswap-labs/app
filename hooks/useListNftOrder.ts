'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useChainId, useSignTypedData } from 'wagmi'
import type { Address } from 'viem'
import { NFT_ORDER_TYPES, nftOrderDomain, type NftOrder } from '@/lib/eip712'
import { getContractAddresses } from '@/config/contract-addresses'

interface ListNftOrderInput {
    seller: Address
    nftContract: Address
    tokenId: bigint
    paymentToken: Address
    price: bigint
    name?: string
    imageUrl?: string
}

const LISTING_EXPIRY_SECONDS = 7 * 24 * 60 * 60

/**
 * Listing is gasless — signTypedData only, no writeContract. POST /api/nft/orders persists the
 * signed order for discovery; the contract itself is only touched later, at fulfillOrder time.
 */
export function useListNftOrder() {
    const { signTypedDataAsync } = useSignTypedData()
    const chainId = useChainId()
    const queryClient = useQueryClient()
    const { nftMarketplace: NFT_MARKETPLACE_ADDRESS } = getContractAddresses(chainId)

    return useMutation({
        mutationFn: async (input: ListNftOrderInput) => {
            if (!NFT_MARKETPLACE_ADDRESS) throw new Error('NftMarketplace is not deployed yet')

            const order: NftOrder = {
                seller: input.seller,
                nftContract: input.nftContract,
                tokenId: input.tokenId,
                paymentToken: input.paymentToken,
                price: input.price,
                nonce: BigInt(Date.now()),
                expiry: BigInt(Math.floor(Date.now() / 1000) + LISTING_EXPIRY_SECONDS),
            }

            const signature = await signTypedDataAsync({
                domain: nftOrderDomain(chainId, NFT_MARKETPLACE_ADDRESS),
                types: NFT_ORDER_TYPES,
                primaryType: 'Order',
                message: order,
            })

            const res = await fetch('/api/nft/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order: {
                        seller: order.seller,
                        nftContract: order.nftContract,
                        tokenId: order.tokenId.toString(),
                        paymentToken: order.paymentToken,
                        price: order.price.toString(),
                        nonce: order.nonce.toString(),
                        expiry: order.expiry.toString(),
                    },
                    signature,
                    chainId,
                    verifyingContract: NFT_MARKETPLACE_ADDRESS,
                    name: input.name,
                    imageUrl: input.imageUrl,
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `listing failed: ${res.status}`)
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nft-orders'] }),
    })
}
