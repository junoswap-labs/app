'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import type { MeResponse } from '@/types/analytics'

/**
 * Current session's wallet (verified server-side via SIWE, never a client-set value).
 * Fetch failure / no session → null.
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
