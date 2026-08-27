'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import { supabaseBrowser } from '@/lib/supabase/client'
import { queryListings } from '@/services/marketplace/listing-query'
import { formatTokenAmount } from '@/lib/tokens'
import type { ListingQuery, NftListing } from '@/types/marketplace'
import type { Database } from '@/types/supabase'

type NftOrderRow = Database['public']['Tables']['nft_orders']['Row']

function mapNftOrderRow(row: NftOrderRow, chainId: number): NftListing {
    const { amount, symbol } = formatTokenAmount(row.price, chainId, row.payment_token)
    return {
        orderHash: row.order_hash as `0x${string}`,
        contract: row.nft_contract as `0x${string}`,
        tokenId: row.token_id,
        price: amount,
        paymentToken: symbol,
        seller: row.seller as `0x${string}`,
        status: row.status === 'filled' ? 'sold' : 'active',
        listedAt: new Date(row.listed_at).getTime(),
        buyer: (row.buyer as `0x${string}` | null) ?? undefined,
        soldAt: row.filled_at ? new Date(row.filled_at).getTime() : undefined,
        name: row.name ?? `#${row.token_id}`,
        imageUrl: row.image_url,
    }
}

/** Cancelled orders are just gone from the marketplace — never fetched as an NftListing at all. */
function useNftOrders() {
    const chainId = useChainId()
    return useQuery({
        queryKey: ['nft-orders', chainId],
        staleTime: 15_000,
        queryFn: async (): Promise<NftListing[]> => {
            const { data, error } = await supabaseBrowser()
                .from('nft_orders')
                .select('*')
                .eq('chain_id', chainId)
                .in('status', ['active', 'filled'])
                .order('listed_at', { ascending: false })
            if (error) throw error
            return data.map((row) => mapNftOrderRow(row, chainId))
        },
    })
}

/** Browse listings with filter/sort applied. */
export function useListings(query: ListingQuery): NftListing[] {
    const { data } = useNftOrders()
    const listings = useMemo(() => data ?? [], [data])
    return useMemo(() => queryListings(listings, query), [listings, query])
}

/** Find a single listing for the detail page, by its real order hash. */
export function useListing(orderHash: string): NftListing | undefined {
    const { data } = useNftOrders()
    return useMemo(
        () => data?.find((l) => l.orderHash.toLowerCase() === orderHash.toLowerCase()),
        [data, orderHash]
    )
}
