'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import type { MeResponse } from '@/types/analytics'

/**
 * Current user's role (from the server-side session, never a client-set value).
 * Used only to gate *visibility* of admin features — real security is always enforced
 * server/contract-side. Fetch failure / missing endpoint → treated as non-admin (safe default = hidden).
 */
export function useCurrentUser() {
    const { address, isConnected } = useAccount()

    return useQuery({
        queryKey: ['me', address],
        enabled: isConnected,
        queryFn: async (): Promise<MeResponse | null> => {
            const res = await fetch('/api/me')
            if (!res.ok) return null
            return res.json()
        },
    })
}

export function useIsAdmin() {
    const { data } = useCurrentUser()
    return data?.role === 'admin' || data?.role === 'arbitrator'
}
