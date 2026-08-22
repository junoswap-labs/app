'use client'

import { useAccount, useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { permissionRegistryAbi } from '@/lib/abis/permission-registry'
import { isDevRoleBypassActive } from '@/lib/onchain/dev-bypass'

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_PERMISSION_REGISTRY_ADDRESS as Address | undefined

/**
 * Admin/Partner/Authorize are on-chain roles (PermissionRegistry.sol) — never DB/session state.
 * A missing NEXT_PUBLIC_PERMISSION_REGISTRY_ADDRESS (not deployed yet) safely resolves to "false"
 * for every role rather than throwing, so pages render sensibly pre-deployment.
 *
 * NEXT_PUBLIC_DEV_ADMIN_BYPASS (local dev only, see lib/onchain/dev-bypass.ts) short-circuits every
 * role to true for any connected wallet — skips the chain read entirely.
 */
function useRole(fn: 'isAdmin' | 'isPartnerMarketplace' | 'isPartnerRedeem' | 'isAuthorized', address?: Address) {
    const bypass = isDevRoleBypassActive() && Boolean(address)
    const { data } = useReadContract({
        address: REGISTRY_ADDRESS,
        abi: permissionRegistryAbi,
        functionName: fn,
        args: address ? [address] : undefined,
        query: { enabled: Boolean(REGISTRY_ADDRESS && address) && !bypass },
    })
    return bypass || (data ?? false)
}

export function useIsAdmin() {
    const { address } = useAccount()
    return useRole('isAdmin', address)
}

export function useIsPartnerMarketplace() {
    const { address } = useAccount()
    return useRole('isPartnerMarketplace', address)
}

export function useIsPartnerRedeem() {
    const { address } = useAccount()
    return useRole('isPartnerRedeem', address)
}

export function useIsAuthorized() {
    const { address } = useAccount()
    return useRole('isAuthorized', address)
}
