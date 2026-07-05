import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareEpochDistribution } from '../settlement'
import { StandardMerkleTree } from '@openzeppelin/merkle-tree'
import type { IndexerCreatorFee } from '../types'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'

function mockIndexer(creators: IndexerCreatorFee[]) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ creators }), { status: 200 }))
    )
}

afterEach(() => vi.unstubAllGlobals())

const params = { chainId: 96, fromDay: 0, toDay: 86_400 }

describe('prepareEpochDistribution', () => {
    it('builds a fundable, verifying distribution from indexer rows', async () => {
        mockIndexer([
            { creator: A, feeNative: (5n * 10n ** 18n).toString(), volumeNative: '0', swapCount: '0' },
            { creator: B, feeNative: (5n * 10n ** 18n).toString(), volumeNative: '0', swapCount: '0' },
        ])

        const dist = await prepareEpochDistribution('http://indexer.test', params)
        expect(dist).not.toBeNull()
        // 5 KKUB fee each -> 4.5 KKUB reward each -> 9 KKUB fund total.
        expect(dist!.total).toBe(9n * 10n ** 18n)

        const proof = dist!.proofs[A]
        expect(
            StandardMerkleTree.verify(
                dist!.root,
                ['address', 'uint256'],
                [A, (45n * 10n ** 17n).toString()],
                proof ?? []
            )
        ).toBe(true)
    })

    it('returns null when every creator is below the dust floor', async () => {
        mockIndexer([
            { creator: A, feeNative: (10n ** 17n).toString(), volumeNative: '0', swapCount: '0' },
        ])
        expect(await prepareEpochDistribution('http://indexer.test', params)).toBeNull()
    })

    it('propagates a non-OK indexer response as an error', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('nope', { status: 500 }))
        )
        await expect(prepareEpochDistribution('http://indexer.test', params)).rejects.toThrow()
    })
})
