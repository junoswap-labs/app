import type { NftListing, ListingQuery } from '@/types/marketplace'

/** Filter + sort listings by query (pure — easy to test, works for client mock and server later) */
export function queryListings(listings: NftListing[], q: ListingQuery): NftListing[] {
    const search = q.search.trim().toLowerCase()

    const filtered = listings.filter((l) => {
        if (q.status !== 'all' && l.status !== q.status) return false
        if (q.contract && l.contract.toLowerCase() !== q.contract.toLowerCase()) return false
        if (search && !l.name.toLowerCase().includes(search) && !l.tokenId.includes(search))
            return false
        return true
    })

    const sorted = [...filtered]
    switch (q.sort) {
        case 'price_asc':
            sorted.sort((a, b) => Number(a.price) - Number(b.price))
            break
        case 'price_desc':
            sorted.sort((a, b) => Number(b.price) - Number(a.price))
            break
        case 'recent':
        default:
            sorted.sort((a, b) => b.listedAt - a.listedAt)
    }
    return sorted
}
