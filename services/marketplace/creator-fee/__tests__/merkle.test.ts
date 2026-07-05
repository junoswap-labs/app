import { describe, expect, it } from 'vitest'
import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import { buildEpochDistribution } from '../merkle'
import type { CreatorReward } from '../types'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const C = '0x3333333333333333333333333333333333333333'

// Independent re-verification that a proof is valid for (creator, amount) under `root`, using
// the same OZ StandardMerkleTree encoding CreatorFeeDistributor.claim reproduces on-chain.
function verify(root: string, creator: string, amount: bigint, proof: string[]): boolean {
    return StandardMerkleTree.verify(
        root,
        ['address', 'uint256'],
        [creator, amount.toString()],
        proof
    )
}

function proofFor(proofs: Record<string, string[]>, creator: string): string[] {
    const p = proofs[creator.toLowerCase()]
    if (!p) throw new Error(`missing proof for ${creator}`)
    return p
}

describe('buildEpochDistribution', () => {
    const rewards: CreatorReward[] = [
        { creator: A, amount: 40n * 10n ** 18n },
        { creator: B, amount: 60n * 10n ** 18n },
        { creator: C, amount: 10n * 10n ** 18n },
    ]

    it('produces a 32-byte root and the correct fund total', () => {
        const dist = buildEpochDistribution(rewards)
        expect(dist.root).toMatch(/^0x[0-9a-f]{64}$/)
        expect(dist.total).toBe(110n * 10n ** 18n)
    })

    it('emits a verifying proof for every creator', () => {
        const dist = buildEpochDistribution(rewards)
        for (const r of rewards) {
            const proof = proofFor(dist.proofs, r.creator)
            expect(verify(dist.root, r.creator, r.amount, proof)).toBe(true)
        }
    })

    it('a proof does not verify for the wrong amount', () => {
        const dist = buildEpochDistribution(rewards)
        const proof = proofFor(dist.proofs, A)
        expect(verify(dist.root, A, 40n * 10n ** 18n + 1n, proof)).toBe(false)
    })

    it('handles a single-creator epoch (root == leaf, empty proof)', () => {
        const dist = buildEpochDistribution([{ creator: A, amount: 5n * 10n ** 18n }])
        const proof = proofFor(dist.proofs, A)
        expect(proof).toEqual([])
        expect(verify(dist.root, A, 5n * 10n ** 18n, proof)).toBe(true)
    })

    it('throws on an empty reward set', () => {
        expect(() => buildEpochDistribution([])).toThrow()
    })
})
