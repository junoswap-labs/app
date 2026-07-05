// One creator's reward for a single epoch, as served by the settlement job's claim data
// (the Python-generated per-epoch JSON). `amount` is KKUB wei; `proof` verifies against that
// epoch's Merkle root in CreatorFeeDistributor.
export interface CreatorFeeClaim {
    epochId: number
    amount: string
    proof: `0x${string}`[]
    // Unix seconds; past this the epoch is forfeited (reclaimable by the treasury) and can no
    // longer be claimed. Equals the epoch's publishedAt + claimWindow.
    claimDeadline: number
}

export type ClaimStatus = 'claimable' | 'claimed' | 'expired'

export interface CreatorFeeClaimRow extends CreatorFeeClaim {
    status: ClaimStatus
}
