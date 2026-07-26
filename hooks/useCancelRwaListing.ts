'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCancelRwaListing() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (listingId: string) => {
            const res = await fetch(`/api/rwa/listings/${listingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled' }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `cancel failed: ${res.status}`)
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rwa-listings'] }),
    })
}
