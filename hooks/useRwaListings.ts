'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import { supabaseBrowser } from '@/lib/supabase/client'
import { formatTokenAmount } from '@/lib/tokens'
import type { RwaListing, RwaStatus } from '@/types/rwa'
import type { Database } from '@/types/supabase'

type RwaListingRow = Database['public']['Tables']['rwa_listings']['Row']
type RwaOrderRow = Database['public']['Tables']['rwa_orders']['Row']

// rwa_listings (pre-funding catalog row) and rwa_orders (the escrow transaction record once
// funded) are two separate tables — see supabase/migrations/0001_base_schema.sql's header
// comment on why — merged client-side into the single RwaListing shape the UI already expects.
function mergeRwaListing(listing: RwaListingRow, order: RwaOrderRow | undefined, chainId: number): RwaListing {
    let status: RwaStatus
    let resolvedToSeller: boolean | undefined

    if (listing.status === 'cancelled') {
        status = 'cancelled'
    } else if (!order) {
        status = 'listed'
    } else {
        switch (order.status) {
            case 'Funded':
                status = 'funded'
                break
            case 'Shipped':
                status = 'shipped'
                break
            case 'Completed':
                status = 'completed'
                break
            case 'Refunded':
                status = 'refunded'
                break
            case 'Disputed':
                status = 'disputed'
                break
            case 'ResolvedSeller':
                status = 'resolved'
                resolvedToSeller = true
                break
            case 'ResolvedBuyer':
                status = 'resolved'
                resolvedToSeller = false
                break
            default:
                status = 'listed'
        }
    }

    const { amount, symbol } = formatTokenAmount(listing.price, chainId, listing.payment_token)

    return {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        imageUrls: listing.image_urls,
        price: amount,
        paymentToken: symbol,
        paymentTokenAddress: listing.payment_token as `0x${string}`,
        seller: listing.seller_wallet as `0x${string}`,
        buyer: (order?.buyer_wallet as `0x${string}` | undefined) ?? undefined,
        status,
        createdAt: new Date(listing.created_at).getTime(),
        fundedAt: order?.funded_at ? new Date(order.funded_at).getTime() : undefined,
        shippedAt: order?.shipped_at ? new Date(order.shipped_at).getTime() : undefined,
        resolvedToSeller,
    }
}

function useRwaData() {
    const chainId = useChainId()
    const listingsQuery = useQuery({
        queryKey: ['rwa-listings', chainId],
        staleTime: 15_000,
        queryFn: async (): Promise<RwaListingRow[]> => {
            const { data, error } = await supabaseBrowser()
                .from('rwa_listings')
                .select('*')
                .eq('chain_id', chainId)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        },
    })
    const ordersQuery = useQuery({
        queryKey: ['rwa-orders', chainId],
        staleTime: 15_000,
        queryFn: async (): Promise<RwaOrderRow[]> => {
            const { data, error } = await supabaseBrowser().from('rwa_orders').select('*').eq('chain_id', chainId)
            if (error) throw error
            return data
        },
    })
    return { listings: listingsQuery.data, orders: ordersQuery.data }
}

export function useRwaListings(): RwaListing[] {
    const { listings, orders } = useRwaData()
    const chainId = useChainId()
    return useMemo(() => {
        if (!listings) return []
        const byId = new Map(orders?.map((o) => [o.id, o]))
        return listings.map((l) => mergeRwaListing(l, byId.get(l.id), chainId))
    }, [listings, orders, chainId])
}

export function useRwaListing(id: string): RwaListing | undefined {
    const listings = useRwaListings()
    return useMemo(() => listings.find((l) => l.id === id), [listings, id])
}
