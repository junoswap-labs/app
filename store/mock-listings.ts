'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NftListing } from '@/types/marketplace'

// MOCK only — stand-in for the nft_orders table + API until the backend is ready.
// Real NFTs on KUB mainnet (CM Hexa Cat Meaw), but price/status/seller are mock.
// Persisted to localStorage so items the user "lists" in the list flow survive refresh.
const CONTRACT = '0x2F022D4Ef37847304eCd167303aeaA9699F73663' as const
const SELLER_A = '0x1111111111111111111111111111111111111111' as const
const SELLER_B = '0x2222222222222222222222222222222222222222' as const

const SEED: NftListing[] = [
    ['174325760', '#667', 'Qmcc3eHFCVzPkrwuCxb5B4YRH9Dq7YMtd7p19rSL3dHAjN', '120.5', 'active', SELLER_A],
    ['174587904', '#669', 'Qmbnonh1qMx66hDnfd6iZ23kaySH8Gjw7XBJakYqq5jLtv', '95', 'active', SELLER_A],
    ['174456832', '#668', 'QmZ1QuQwm3tzthtHcJSzEpuAaKcap5kBf9q2vWMd8gUiwr', '210', 'active', SELLER_B],
    ['174194688', '#665', 'QmWri2uiydN5qPs4a3VruZE5D72YWPMWeY4R6enKxbJEZ6', '88.8', 'sold', SELLER_B],
    ['174063616', '#664', 'QmQDMooWdiQqjLG6NDKzPkkyBxVcMhbo2B44QsTGBjDB5D', '300', 'active', SELLER_A],
    ['173408256', '#659', 'QmU4QcxJQsCKz1sUyqaj4LtoPvBf21iU7MNyudrCJVVVja', '150', 'active', SELLER_B],
    ['173670400', '#661', 'QmW8dG8Jkb38uwSoLBXSHaPSDGe7AywxvKqApQAGEMhhM3', '175.25', 'active', SELLER_A],
    ['173277184', '#658', 'QmUhy7XvedBeS1gFQTpZ8AbBwRB6PtWkt9HwX3E5eBmsoi', '64', 'sold', SELLER_A],
    ['173539328', '#660', 'QmeCXwUBVcibdEywfsgUA5T5wV1zFQoFELygwxT2NeCrT1', '420', 'active', SELLER_B],
    ['173932544', '#663', 'QmNj4RX2wVNRBPePTLJaAafuvdjJridNtkd4ucPaffFKpr', '110', 'active', SELLER_A],
    ['172883968', '#655', 'QmNjZdxJxVoDUHC5iq9mpUxW5u4q5Us18G1wrvSY2TqtaC', '99.99', 'active', SELLER_B],
].map(([tokenId, num, cid, price, status, seller], i) => ({
    contract: CONTRACT,
    tokenId: tokenId!,
    name: `CM Hexa Cat Meaw ${num}`,
    imageUrl: `https://bitkubipfs.io/ipfs/${cid}`,
    price: price!,
    paymentToken: 'KKUB',
    seller: seller as `0x${string}`,
    status: status as NftListing['status'],
    listedAt: Date.now() - i * 3_600_000, // staggered timestamps so recent sort is meaningful
}))

interface MockListingState {
    listings: NftListing[]
    addListing: (l: NftListing) => void
    markSold: (contract: string, tokenId: string, buyer: `0x${string}`) => void
    // Real flow: cancel is always an on-chain cancelOrder() tx — DB-only delisting is not enough
    removeListing: (contract: string, tokenId: string) => void
}

export const useMockListings = create<MockListingState>()(
    persist(
        (set) => ({
            listings: SEED,
            addListing: (l) =>
                set((s) => ({ listings: [{ ...l, listedAt: Date.now() }, ...s.listings] })),
            markSold: (contract, tokenId, buyer) =>
                set((s) => ({
                    listings: s.listings.map((l) =>
                        l.contract.toLowerCase() === contract.toLowerCase() && l.tokenId === tokenId
                            ? { ...l, status: 'sold' as const, buyer, soldAt: Date.now() }
                            : l
                    ),
                })),
            removeListing: (contract, tokenId) =>
                set((s) => ({
                    listings: s.listings.filter(
                        (l) =>
                            !(
                                l.contract.toLowerCase() === contract.toLowerCase() &&
                                l.tokenId === tokenId
                            )
                    ),
                })),
        }),
        { name: 'mock-listings-v1' }
    )
)
