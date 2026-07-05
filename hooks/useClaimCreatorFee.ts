'use client'

import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { useQueryClient } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi'
import {
    CREATOR_FEE_DISTRIBUTOR_ABI,
    getCreatorFeeDistributorAddress,
} from '@/lib/abis/creator-fee-distributor'
import { toastError, toastSuccess } from '@/lib/toast'
import type { CreatorFeeClaimRow } from '@/types/creator-fee'

// -1 is the "claim all" sentinel so the panel can show a spinner on the batch button without
// colliding with a specific epochId.
const CLAIM_ALL = -1

// Write-side of the claim flow. Follows the repo's clean workflow: send tx -> wait for the
// receipt -> invalidate the on-chain reads so useCreatorFeeClaims re-derives status. Never
// flips UI to "claimed" off the receipt alone; the refetched hasClaimed does that.
export function useClaimCreatorFee(): {
    claim: (row: CreatorFeeClaimRow) => Promise<void>
    claimAll: (rows: CreatorFeeClaimRow[]) => Promise<void>
    pendingEpoch: number | null
    isPending: boolean
} {
    const { chainId } = useAccount()
    const { writeContractAsync } = useWriteContract()
    const queryClient = useQueryClient()
    const [pendingEpoch, setPendingEpoch] = useState<number | null>(null)

    const distributor = getCreatorFeeDistributorAddress(chainId)

    async function run(
        pendingKey: number,
        send: (to: `0x${string}`) => Promise<`0x${string}`>,
        successMsg: string
    ) {
        if (!distributor) {
            toastError('Fee campaign is not available on this network')
            return
        }
        try {
            setPendingEpoch(pendingKey)
            const hash = await send(distributor)
            await waitForTransactionReceipt(wagmiConfig, { hash })
            toastSuccess(successMsg)
            await queryClient.invalidateQueries({ queryKey: ['readContracts'] })
        } catch (e) {
            toastError(e as Error)
        } finally {
            setPendingEpoch(null)
        }
    }

    function claim(row: CreatorFeeClaimRow) {
        return run(
            row.epochId,
            (to) =>
                writeContractAsync({
                    address: to,
                    abi: CREATOR_FEE_DISTRIBUTOR_ABI,
                    functionName: 'claim',
                    args: [BigInt(row.epochId), BigInt(row.amount), row.proof],
                }),
            `Claimed epoch ${row.epochId}`
        )
    }

    function claimAll(rows: CreatorFeeClaimRow[]) {
        const claimable = rows.filter((r) => r.status === 'claimable')
        if (claimable.length === 0) return Promise.resolve()
        return run(
            CLAIM_ALL,
            (to) =>
                writeContractAsync({
                    address: to,
                    abi: CREATOR_FEE_DISTRIBUTOR_ABI,
                    functionName: 'claimMany',
                    args: [
                        claimable.map((r) => ({
                            epochId: BigInt(r.epochId),
                            amount: BigInt(r.amount),
                            proof: r.proof,
                        })),
                    ],
                }),
            `Claimed ${claimable.length} epoch${claimable.length > 1 ? 's' : ''}`
        )
    }

    return { claim, claimAll, pendingEpoch, isPending: pendingEpoch !== null }
}
