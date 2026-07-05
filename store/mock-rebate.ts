'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MOCK_REBATE_NFTS } from '@/lib/mock/rebate'
import type { RebateNft } from '@/types/rebate'

// MOCK only — shared burn/stake state so the rebate overview and the
// per-collection page stay in sync. Real flow: contract reads via wagmi + poller.
interface MockRebateState {
    nfts: RebateNft[]
    updateNft: (target: RebateNft, patch: Partial<RebateNft>) => void
}

export const useMockRebate = create<MockRebateState>()(
    persist(
        (set) => ({
            nfts: MOCK_REBATE_NFTS,
            updateNft: (target, patch) =>
                set((s) => ({
                    nfts: s.nfts.map((n) =>
                        n.collection === target.collection && n.tokenId === target.tokenId
                            ? { ...n, ...patch }
                            : n
                    ),
                })),
        }),
        { name: 'mock-rebate' }
    )
)
