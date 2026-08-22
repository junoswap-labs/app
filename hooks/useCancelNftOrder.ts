'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { nftMarketplaceAbi } from '@/lib/abis/nft-marketplace'
import { useSyncRefresh } from '@/hooks/useSyncRefresh'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import { loadOrder } from '@/hooks/useFulfillNftOrder'

const NFT_MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS as Address | undefined

/** On-chain cancel is mandatory — a DB-only delist would leave the signature redeemable forever. */
export function useCancelNftOrder() {
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (orderHash: `0x${string}`) => {
            if (!NFT_MARKETPLACE_ADDRESS) throw new Error('NftMarketplace is not deployed yet')
            const { order } = await loadOrder(orderHash)

            const hash = await write({
                address: NFT_MARKETPLACE_ADDRESS,
                abi: nftMarketplaceAbi,
                functionName: 'cancelOrder',
                args: [order],
            })
            if (!publicClient) throw new Error('no public client available')
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()
            return hash
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nft-orders'] }),
    })
}
