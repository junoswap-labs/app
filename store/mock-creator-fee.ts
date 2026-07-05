'use client'

import { create } from 'zustand'
import type { CreatorFeeClaim } from '@/types/creator-fee'

// MOCK only — stand-in for the real claim data source. In production these rows come from the
// Python settlement script's per-epoch claim JSON (scripts/creator_fee/settlement.py), served
// via an API route / Supabase and filtered to the connected creator. Shape here matches one
// entry of that JSON's `claims[]` plus the epoch's claimDeadline, keyed by creator so the hook
// can filter by wallet.
export interface MockCreatorFeeClaim extends CreatorFeeClaim {
    creator: `0x${string}`
}

const DEMO_CREATOR = '0x1111111111111111111111111111111111111111' as const
const DAY = 86_400
const now = Math.floor(Date.now() / 1000)

// Two open epochs + one already expired, so the UI exercises every status branch. Proofs are
// placeholders — a real claim reverts unless the on-chain root matches the settlement output.
const SEED: MockCreatorFeeClaim[] = [
    { creator: DEMO_CREATOR, epochId: 1, amount: '4500000000000000000', proof: [], claimDeadline: now - DAY },
    { creator: DEMO_CREATOR, epochId: 2, amount: '12300000000000000000', proof: [], claimDeadline: now + 14 * DAY },
    { creator: DEMO_CREATOR, epochId: 3, amount: '7800000000000000000', proof: [], claimDeadline: now + 21 * DAY },
]

interface MockCreatorFeeState {
    claims: MockCreatorFeeClaim[]
}

export const useMockCreatorFeeClaims = create<MockCreatorFeeState>()(() => ({
    claims: SEED,
}))
