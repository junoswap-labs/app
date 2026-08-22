'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { rwaEscrowAbi } from '@/lib/abis/rwa-escrow'
import { ensureTokenAllowance } from '@/lib/onchain/erc20'
import { useSyncRefresh } from '@/hooks/useSyncRefresh'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'

const RWA_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_RWA_ESCROW_ADDRESS as Address | undefined

/**
 * Shared plumbing for every RwaEscrow write action — the exact 4-step Clean Workflow from
 * CLAUDE.md: writeContract → wait for receipt → useSyncRefresh() → invalidate + re-fetch.
 * Named hooks below (useFundRwaOrder etc.) each pin down a concrete, correctly-typed argument
 * list for their action — this internal helper trades away compile-time arg-shape checking
 * (functionName is a plain string here) so that tradeoff stays contained to one file.
 */
function useRwaWrite(functionName: string) {
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (args: readonly unknown[]) => {
            if (!RWA_ESCROW_ADDRESS) throw new Error('RwaEscrow is not deployed yet')
            const hash = await write({
                address: RWA_ESCROW_ADDRESS,
                abi: rwaEscrowAbi,
                functionName,
                args,
            })
            if (!publicClient) throw new Error('no public client available')
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()
            return hash
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rwa-orders'] })
            queryClient.invalidateQueries({ queryKey: ['rwa-listings'] })
        },
    })
}

/** Funding needs an ERC20 approve first if the current allowance is short — checked live, not
 *  assumed, so a partial prior approval (e.g. from a previous failed attempt) is topped up rather
 *  than skipped or over-approved. */
export function useFundRwaOrder() {
    const { address } = useAccount()
    const { writeContractAsync } = useWriteContract()
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: async ({
            listingId,
            seller,
            paymentToken,
            amount,
        }: {
            listingId: `0x${string}`
            seller: Address
            paymentToken: Address
            amount: bigint
        }) => {
            if (!RWA_ESCROW_ADDRESS) throw new Error('RwaEscrow is not deployed yet')
            if (!address) throw new Error('connect your wallet first')
            if (!publicClient) throw new Error('no public client available')

            await ensureTokenAllowance({
                publicClient,
                writeContractAsync,
                token: paymentToken,
                owner: address,
                spender: RWA_ESCROW_ADDRESS,
                amount,
            })

            const hash = await write({
                address: RWA_ESCROW_ADDRESS,
                abi: rwaEscrowAbi,
                functionName: 'fund',
                args: [listingId, seller, paymentToken, amount],
            })
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()
            return hash
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rwa-orders'] })
            queryClient.invalidateQueries({ queryKey: ['rwa-listings'] })
        },
    })

    return {
        ...mutation,
        fundAsync: (listingId: `0x${string}`, seller: Address, paymentToken: Address, amount: bigint) =>
            mutation.mutateAsync({ listingId, seller, paymentToken, amount }),
    }
}

export function useMarkShipped() {
    const mutation = useRwaWrite('markShipped')
    return { ...mutation, markShippedAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

export function useConfirmReceived() {
    const mutation = useRwaWrite('confirmReceived')
    return { ...mutation, confirmReceivedAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

export function useClaimRefund() {
    const mutation = useRwaWrite('claimRefund')
    return { ...mutation, claimRefundAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

export function useOpenDispute() {
    const mutation = useRwaWrite('openDispute')
    return { ...mutation, openDisputeAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

export function useResolveDispute() {
    const mutation = useRwaWrite('resolveDispute')
    return {
        ...mutation,
        resolveDisputeAsync: (listingId: `0x${string}`, releaseToSeller: boolean) =>
            mutation.mutateAsync([listingId, releaseToSeller]),
    }
}

export function useClaimShipmentTimeout() {
    const mutation = useRwaWrite('claimShipmentTimeout')
    return {
        ...mutation,
        claimShipmentTimeoutAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]),
    }
}
