'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { rwaEscrowAbi } from '@/lib/abis/rwa-escrow'
import { useSyncRefresh } from '@/hooks/useSyncRefresh'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import { useContractAddresses } from '@/hooks/useContractAddresses'

/** Same Clean Workflow plumbing as hooks/useRwaActions.ts's useRwaWrite, pointed at the
 *  Redeem-dedicated RwaEscrow deployment instead of the Marketplace one — see that file's comment
 *  for why this can't just be parameterized into one shared hook (different query keys, different
 *  deployed address). */
function useRedeemRwaWrite(functionName: string) {
    const { redeemRwaEscrow: REDEEM_RWA_ESCROW_ADDRESS } = useContractAddresses()
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (args: readonly unknown[]) => {
            if (!REDEEM_RWA_ESCROW_ADDRESS) throw new Error('Redeem escrow is not deployed yet')
            const hash = await write({
                address: REDEEM_RWA_ESCROW_ADDRESS,
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
            queryClient.invalidateQueries({ queryKey: ['redeem-orders'] })
        },
    })
}

/** Lister/Admin fulfillment action — STEP 3. */
export function useMarkRedeemShipped() {
    const mutation = useRedeemRwaWrite('markShipped')
    return { ...mutation, markShippedAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

/** Buyer confirms receipt — unlocks funds to the Lister immediately. */
export function useConfirmRedeemReceived() {
    const mutation = useRedeemRwaWrite('confirmReceived')
    return { ...mutation, confirmReceivedAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

/** Buyer's one-time "extend 7 days" button for slow/international shipping — see
 *  contracts/src/RwaEscrow.sol's extendAutoRelease(). */
export function useExtendRedeemAutoRelease() {
    const mutation = useRedeemRwaWrite('extendAutoRelease')
    return { ...mutation, extendAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

/** Permissionless — anyone can trigger the unlock-to-Lister once the (possibly extended)
 *  auto-release deadline has passed and the buyer never confirmed. */
export function useClaimRedeemShipmentTimeout() {
    const mutation = useRedeemRwaWrite('claimShipmentTimeout')
    return { ...mutation, claimAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}

export function useClaimRedeemRefund() {
    const mutation = useRedeemRwaWrite('claimRefund')
    return { ...mutation, claimRefundAsync: (listingId: `0x${string}`) => mutation.mutateAsync([listingId]) }
}
