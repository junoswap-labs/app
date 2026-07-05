'use client'

import { useMemo } from 'react'
import { useAccount, useReadContracts } from 'wagmi'
import {
    CREATOR_FEE_DISTRIBUTOR_ABI,
    getCreatorFeeDistributorAddress,
} from '@/lib/abis/creator-fee-distributor'
import { useMockCreatorFeeClaims } from '@/store/mock-creator-fee'
import type { ClaimStatus, CreatorFeeClaim, CreatorFeeClaimRow } from '@/types/creator-fee'

// Resolves the connected creator's claimable epochs. Reward amounts + proofs come from the
// settlement data source (mock for now); the per-epoch status is derived on-chain — hasClaimed
// is the source of truth for "already claimed", the deadline for "expired". Never trust the
// data source's own claimed flag: a claim could have landed since it was generated.
export function useCreatorFeeClaims(): {
    rows: CreatorFeeClaimRow[]
    isLoading: boolean
    totalClaimable: bigint
} {
    const { address, chainId } = useAccount()
    const distributor = getCreatorFeeDistributorAddress(chainId)
    const allClaims = useMockCreatorFeeClaims((s) => s.claims)

    const claims: CreatorFeeClaim[] = useMemo(
        () =>
            address
                ? allClaims.filter((c) => c.creator.toLowerCase() === address.toLowerCase())
                : [],
        [allClaims, address]
    )

    const contracts =
        distributor && address
            ? claims.map((c) => ({
                  address: distributor,
                  abi: CREATOR_FEE_DISTRIBUTOR_ABI,
                  functionName: 'hasClaimed' as const,
                  args: [BigInt(c.epochId), address] as const,
              }))
            : []

    const { data, isLoading } = useReadContracts({
        contracts,
        query: { enabled: contracts.length > 0 },
    })

    const rows: CreatorFeeClaimRow[] = useMemo(() => {
        const nowSec = Math.floor(Date.now() / 1000)
        return claims.map((c, i) => {
            const claimed = data?.[i]?.result === true
            let status: ClaimStatus = 'claimable'
            if (claimed) status = 'claimed'
            else if (nowSec > c.claimDeadline) status = 'expired'
            return { ...c, status }
        })
    }, [claims, data])

    const totalClaimable = useMemo(
        () =>
            rows
                .filter((r) => r.status === 'claimable')
                .reduce((sum, r) => sum + BigInt(r.amount), 0n),
        [rows]
    )

    return { rows, isLoading, totalClaimable }
}
