import { fetchCreatorFees } from './indexer'
import { computeEpochRewards } from './reward'
import { buildEpochDistribution } from './merkle'
import type { EpochDistribution } from './types'

// End-to-end epoch settlement (read-only): pull each creator's fee basis from the junoswap
// indexer for the day window [fromDay, toDay), apply the 90% share (dust-filtered), and build
// the Merkle distribution. The caller then funds + publishes it on-chain via
// CreatorFeeDistributor.publishEpoch(epochId, dist.root, dist.total) and persists dist.proofs
// for the claim UI. Returns null when no creator cleared the payout floor — the caller should
// skip publishing an empty epoch.
export async function prepareEpochDistribution(
    indexerUrl: string,
    params: {
        chainId: number
        fromDay: number
        toDay: number
        rewardBps?: bigint
        minRewardWei?: bigint
    }
): Promise<EpochDistribution | null> {
    const rows = await fetchCreatorFees(indexerUrl, params)
    const rewards = computeEpochRewards(rows, {
        rewardBps: params.rewardBps,
        minRewardWei: params.minRewardWei,
    })
    if (rewards.length === 0) return null
    return buildEpochDistribution(rewards)
}
