'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { nftMarketplaceAbi } from '@/lib/abis/nft-marketplace'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useSyncRefresh } from '@/hooks/useSyncRefresh'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import type { Database } from '@/types/supabase'
import { useContractAddresses } from '@/hooks/useContractAddresses'

type NftOrderRow = Database['public']['Tables']['nft_orders']['Row']

export async function loadOrder(orderHash: string) {
    // Explicit generic — postgrest-js's select('*') + single() type-level inference doesn't
    // always resolve cleanly against a hand-written (non-generated) Database type; pin it down
    // rather than fight the inference.
    const { data, error } = await supabaseBrowser()
        .from('nft_orders')
        .select('*')
        .eq('order_hash', orderHash)
        .single<NftOrderRow>()
    if (error || !data) throw new Error('order not found')
    return {
        order: {
            seller: data.seller as Address,
            nftContract: data.nft_contract as Address,
            tokenId: BigInt(data.token_id),
            paymentToken: data.payment_token as Address,
            price: BigInt(data.price),
            nonce: BigInt(data.nonce),
            expiry: BigInt(data.expiry),
        },
        signature: data.signature as `0x${string}`,
    }
}

/** Buy — the one on-chain tx in the whole NFT flow (listing itself was gasless). */
export function useFulfillNftOrder() {
    const { nftMarketplace: NFT_MARKETPLACE_ADDRESS } = useContractAddresses()
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (orderHash: `0x${string}`) => {
            if (!NFT_MARKETPLACE_ADDRESS) throw new Error('NftMarketplace is not deployed yet')
            const { order, signature } = await loadOrder(orderHash)

            const hash = await write({
                address: NFT_MARKETPLACE_ADDRESS,
                abi: nftMarketplaceAbi,
                functionName: 'fulfillOrder',
                args: [order, signature],
            })
            if (!publicClient) throw new Error('no public client available')
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()
            return hash
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nft-orders'] }),
    })
}
