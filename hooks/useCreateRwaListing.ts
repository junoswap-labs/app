'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

interface CreateRwaListingInput {
    title: string
    description: string
    imageUrls: string[]
    price: string
    paymentToken: string
}

/** Listing an RWA item is off-chain (no gas until someone funds it) — just a DB insert. */
export function useCreateRwaListing() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (input: CreateRwaListingInput) => {
            const res = await fetch('/api/rwa/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `listing failed: ${res.status}`)
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rwa-listings'] }),
    })
}
