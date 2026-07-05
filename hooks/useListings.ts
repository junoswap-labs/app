'use client'

import { useMemo } from 'react'
import { useMockListings } from '@/store/mock-listings'
import { queryListings } from '@/services/marketplace/listing-query'
import type { ListingQuery, NftListing } from '@/types/marketplace'

/** Browse listings with filter/sort applied (mock store → swap to API/Supabase later) */
export function useListings(query: ListingQuery): NftListing[] {
    const listings = useMockListings((s) => s.listings)
    return useMemo(() => queryListings(listings, query), [listings, query])
}

/** Find a single listing for the detail page */
export function useListing(contract: string, tokenId: string): NftListing | undefined {
    const listings = useMockListings((s) => s.listings)
    return useMemo(
        () =>
            listings.find(
                (l) => l.contract.toLowerCase() === contract.toLowerCase() && l.tokenId === tokenId
            ),
        [listings, contract, tokenId]
    )
}
