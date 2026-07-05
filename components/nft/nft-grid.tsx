'use client'

import { useEffect, useRef, useState } from 'react'
import { NftCard } from '@/components/nft/nft-card'
import { ListingToolbar } from '@/components/nft/listing-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { useListings } from '@/hooks/useListings'
import type { ListingQuery } from '@/types/marketplace'

const PAGE_SIZE = 8

export function NftGrid() {
    const [query, setQuery] = useState<ListingQuery>({ search: '', status: 'all', sort: 'recent' })
    const [count, setCount] = useState(PAGE_SIZE)
    const listings = useListings(query)
    const sentinelRef = useRef<HTMLDivElement>(null)

    // Reset visible count when filter/search changes
    useEffect(() => setCount(PAGE_SIZE), [query])

    useEffect(() => {
        const el = sentinelRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) setCount((c) => c + PAGE_SIZE)
            },
            { rootMargin: '600px' }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const visible = listings.slice(0, count)

    return (
        <div className="space-y-5">
            <ListingToolbar query={query} onChange={setQuery} />

            {visible.length === 0 ? (
                <EmptyState title="No NFTs found" description="Try a different search or filter." />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {visible.map((l) => (
                            <NftCard key={`${l.contract}-${l.tokenId}`} listing={l} />
                        ))}
                    </div>
                    {count < listings.length && <div ref={sentinelRef} className="h-12" aria-hidden />}
                </>
            )}
        </div>
    )
}
