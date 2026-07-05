import { describe, expect, it } from 'vitest'
import {
    computeEpochRewards,
    computeReward,
    MIN_REWARD_WEI,
    totalRewards,
} from '../reward'
import type { IndexerCreatorFee } from '../types'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'

function row(creator: string, feeNative: bigint): IndexerCreatorFee {
    return { creator, feeNative: feeNative.toString(), volumeNative: '0', swapCount: '0' }
}

describe('computeReward', () => {
    it('pays 90% of the fee', () => {
        expect(computeReward(100n)).toBe(90n)
        expect(computeReward(10n ** 19n)).toBe(9n * 10n ** 18n)
    })

    it('honors a custom bps', () => {
        expect(computeReward(100n, 5000n)).toBe(50n)
    })
})

describe('computeEpochRewards', () => {
    it('applies 90% and keeps creators above the dust floor', () => {
        // fee 2 KKUB -> reward 1.8 KKUB (>= 1 KKUB min)
        const rewards = computeEpochRewards([row(A, 2n * 10n ** 18n)])
        expect(rewards).toEqual([{ creator: A, amount: (2n * 10n ** 18n * 9000n) / 10000n }])
    })

    it('drops rewards below MIN_REWARD_WEI', () => {
        // fee 1 KKUB -> reward 0.9 KKUB (< 1 KKUB) -> dropped
        expect(computeEpochRewards([row(A, 10n ** 18n)])).toEqual([])
    })

    it('aggregates duplicate creators (case-insensitive) before the threshold', () => {
        // Two sub-threshold rows for the same creator that clear the floor once summed.
        const rewards = computeEpochRewards([
            row(A.toUpperCase(), 10n ** 18n),
            row(A, 10n ** 18n),
        ])
        expect(rewards).toEqual([{ creator: A, amount: (2n * 10n ** 18n * 9000n) / 10000n }])
    })

    it('skips zero/empty rows and sorts by creator', () => {
        const rewards = computeEpochRewards([
            row(B, 5n * 10n ** 18n),
            row('', 5n * 10n ** 18n),
            row(A, 5n * 10n ** 18n),
            row(B, 0n),
        ])
        expect(rewards.map((r) => r.creator)).toEqual([A, B])
    })

    it('respects a custom minRewardWei', () => {
        const rewards = computeEpochRewards([row(A, 10n ** 18n)], { minRewardWei: 0n })
        expect(rewards).toHaveLength(1)
    })
})

describe('totalRewards', () => {
    it('sums the reward amounts', () => {
        // Each 5 KKUB fee -> 4.5 KKUB reward; two creators -> 9 KKUB total.
        const rewards = computeEpochRewards([
            row(A, 5n * 10n ** 18n),
            row(B, 5n * 10n ** 18n),
        ])
        expect(totalRewards(rewards)).toBe(9n * 10n ** 18n)
    })

    it('is 0 for an empty distribution', () => {
        expect(totalRewards([])).toBe(0n)
    })
})

describe('MIN_REWARD_WEI', () => {
    it('is 1 KKUB', () => {
        expect(MIN_REWARD_WEI).toBe(10n ** 18n)
    })
})
