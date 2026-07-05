import type { CreatorReward, IndexerCreatorFee } from './types'

// The campaign pays each creator this share of the fee their tokens generated on the curve.
// The protocol keeps the other 10%, so trading (even self-trading) is always net-positive for
// the treasury — there is no anti-wash-trading rule by design.
export const CREATOR_REWARD_BPS = 9000n // 90%

// Rewards below this are dropped from the epoch tree; the dust rolls into the treasury
// remainder (reclaimed after the window) instead of bloating the tree and costing the creator
// gas to claim a trivial amount. 1 KKUB (18 decimals).
export const MIN_REWARD_WEI = 10n ** 18n

export function computeReward(
    feeNativeWei: bigint,
    rewardBps: bigint = CREATOR_REWARD_BPS
): bigint {
    return (feeNativeWei * rewardBps) / 10_000n
}

// Turn the indexer's per-creator fee rows into an epoch's reward list: aggregate by creator
// (defensively — the indexer already groups, but we lowercase + sum duplicates), apply the
// 90% share, drop rewards below MIN_REWARD_WEI, and sort by creator so the resulting Merkle
// tree is deterministic for a given input.
export function computeEpochRewards(
    rows: IndexerCreatorFee[],
    opts: { rewardBps?: bigint; minRewardWei?: bigint } = {}
): CreatorReward[] {
    const rewardBps = opts.rewardBps ?? CREATOR_REWARD_BPS
    const minReward = opts.minRewardWei ?? MIN_REWARD_WEI

    const feeByCreator = new Map<string, bigint>()
    for (const row of rows) {
        if (!row.creator) continue
        const creator = row.creator.toLowerCase()
        const fee = BigInt(row.feeNative ?? '0')
        if (fee <= 0n) continue
        feeByCreator.set(creator, (feeByCreator.get(creator) ?? 0n) + fee)
    }

    const rewards: CreatorReward[] = []
    for (const [creator, fee] of feeByCreator) {
        const amount = computeReward(fee, rewardBps)
        if (amount < minReward) continue
        rewards.push({ creator, amount })
    }
    rewards.sort((a, b) => (a.creator < b.creator ? -1 : a.creator > b.creator ? 1 : 0))
    return rewards
}

export function totalRewards(rewards: CreatorReward[]): bigint {
    return rewards.reduce((sum, r) => sum + r.amount, 0n)
}
