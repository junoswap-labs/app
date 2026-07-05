// Row shape returned by the junoswap indexer's GET /campaign/creator-fees — one entry per
// creator, fees summed over the queried day window. Numeric fields are decimal wei strings.
export interface IndexerCreatorFee {
    creator: string
    feeNative: string // native (KKUB) wei of pumpFee this creator's tokens generated
    volumeNative: string
    swapCount: string
}

// One creator's computed reward for an epoch, in payout-token (KKUB) wei.
export interface CreatorReward {
    creator: string
    amount: bigint
}

// Everything the settlement job needs to fund + publish an epoch and serve claims.
export interface EpochDistribution {
    root: `0x${string}`
    total: bigint // sum of all rewards == the amount to fund publishEpoch with
    rewards: CreatorReward[]
    proofs: Record<string, string[]> // lowercased creator => Merkle proof for the claim UI
}
