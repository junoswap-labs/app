'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import type { MeResponse } from '@/types/analytics'

/**
 * Current session's wallet (verified server-side via SIWE, never a client-set value).
 * Fetch failure / no session → null.
 */
export function useCurrentUser(options?: { refetchInterval?: number | false }) {
    const { address, isConnected } = useAccount()

    return useQuery({
        queryKey: ['me', address],
        enabled: isConnected,
        refetchInterval: options?.refetchInterval,
        queryFn: async (): Promise<MeResponse | null> => {
            const res = await fetch('/api/me')
            if (!res.ok) return null
            return res.json()
        },
    })
}

/** Settings page notification toggles — the only self-serve-editable fields on the users row. */
export function useUpdateNotifyPrefs() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (input: { notify_new_offer?: boolean; notify_deadline?: boolean }) => {
            const res = await fetch('/api/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `update failed: ${res.status}`)
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
    })
}
