'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RwaListing } from '@/types/rwa'

// MOCK only — stand-in for rwa_listings + escrow contract until backend/contract are wired.
// Real flow: every mutation below becomes writeContract → receipt → POST /api/sync/refresh →
// re-fetch from Supabase (status written only by the poller).
const SEED: RwaListing[] = [
    {
        id: 'rwa-1',
        title: 'Limited Junoswap Hoodie (L)',
        description: 'Official embroidered hoodie, size L. Ships from Chiang Mai within 3 days.',
        imageUrls: [],
        price: '450',
        paymentToken: 'KKUB',
        seller: '0x1111111111111111111111111111111111111111',
        status: 'listed',
        createdAt: Date.now() - 2 * 24 * 3_600_000,
    },
    {
        id: 'rwa-2',
        title: 'Hexa Cat Figurine — Hand Painted',
        description: 'Resin figurine, 12cm, numbered edition of 50.',
        imageUrls: ['https://bitkubipfs.io/ipfs/QmQDMooWdiQqjLG6NDKzPkkyBxVcMhbo2B44QsTGBjDB5D'],
        price: '1200',
        paymentToken: 'KKUB',
        seller: '0x2222222222222222222222222222222222222222',
        status: 'listed',
        createdAt: Date.now() - 5 * 24 * 3_600_000,
    },
]

interface MockRwaState {
    listings: RwaListing[]
    addListing: (l: RwaListing) => void
    update: (id: string, patch: Partial<RwaListing>) => void
}

export const useMockRwa = create<MockRwaState>()(
    persist(
        (set) => ({
            listings: SEED,
            addListing: (l) => set((s) => ({ listings: [l, ...s.listings] })),
            update: (id, patch) =>
                set((s) => ({
                    listings: s.listings.map((l) => (l.id === id ? { ...l, ...patch } : l)),
                })),
        }),
        { name: 'mock-rwa' }
    )
)
