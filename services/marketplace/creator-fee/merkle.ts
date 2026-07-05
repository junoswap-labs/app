import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import type { CreatorReward, EpochDistribution } from './types'
import { totalRewards } from './reward'

// Build an epoch's Merkle tree over (creator, amount) pairs. The ['address','uint256']
// StandardMerkleTree encoding matches CreatorFeeDistributor.claim's leaf
// (keccak256(keccak256(abi.encode(account, amount)))), so proofs produced here verify on-chain.
// Returns the root, the total to fund the epoch with, and per-creator proofs keyed by
// lowercased address for the claim UI to look up.
export function buildEpochDistribution(rewards: CreatorReward[]): EpochDistribution {
    if (rewards.length === 0) {
        throw new Error('cannot build a distribution with no rewards')
    }

    const values = rewards.map((r) => [r.creator, r.amount.toString()])
    const tree = StandardMerkleTree.of(values, ['address', 'uint256'])

    const proofs: Record<string, string[]> = {}
    for (const [i, value] of tree.entries()) {
        const creator = String(value[0]).toLowerCase()
        proofs[creator] = tree.getProof(i)
    }

    return {
        root: tree.root as `0x${string}`,
        total: totalRewards(rewards),
        rewards,
        proofs,
    }
}
