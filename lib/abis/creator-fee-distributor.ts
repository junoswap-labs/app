import type { Address } from 'viem'
import { bitkub, kubTestnet } from '@/lib/wagmi'

// The slice of CreatorFeeDistributor the claim UI needs: read hasClaimed/epochs to derive
// per-epoch status, and write claim/claimMany. `claimMany`'s tuple[] must match the contract's
// ClaimInput{ epochId, amount, proof } exactly, or viem encodes the wrong calldata.
export const CREATOR_FEE_DISTRIBUTOR_ABI = [
    {
        type: 'function',
        name: 'claim',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'epochId', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
            { name: 'proof', type: 'bytes32[]' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'claimMany',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'claims',
                type: 'tuple[]',
                components: [
                    { name: 'epochId', type: 'uint256' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'proof', type: 'bytes32[]' },
                ],
            },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'hasClaimed',
        stateMutability: 'view',
        inputs: [
            { name: 'epochId', type: 'uint256' },
            { name: 'creator', type: 'address' },
        ],
        outputs: [{ type: 'bool' }],
    },
    {
        type: 'function',
        name: 'epochs',
        stateMutability: 'view',
        inputs: [{ name: 'epochId', type: 'uint256' }],
        outputs: [
            { name: 'merkleRoot', type: 'bytes32' },
            { name: 'totalFunded', type: 'uint256' },
            { name: 'totalClaimed', type: 'uint256' },
            { name: 'publishedAt', type: 'uint256' },
            { name: 'reclaimed', type: 'bool' },
        ],
    },
    {
        type: 'function',
        name: 'claimWindow',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
    },
] as const

const ADDRESSES: Record<number, Address | undefined> = {
    [bitkub.id]: process.env.NEXT_PUBLIC_CREATOR_FEE_DISTRIBUTOR_96 as Address | undefined,
    [kubTestnet.id]: process.env.NEXT_PUBLIC_CREATOR_FEE_DISTRIBUTOR_25925 as Address | undefined,
}

const ZERO = '0x0000000000000000000000000000000000000000'

export function getCreatorFeeDistributorAddress(chainId: number | undefined): Address | undefined {
    if (chainId === undefined) return undefined
    const addr = ADDRESSES[chainId]
    return addr && addr !== ZERO ? addr : undefined
}
