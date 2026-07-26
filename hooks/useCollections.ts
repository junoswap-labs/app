'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { Collection } from '@/types/collection'

// Collection metadata almost never changes — staleTime Infinity avoids re-querying on every
// grid/card mount; React Query's cache already coalesces concurrent requests for the same
// contract (e.g. many NftCard instances of the same collection), so there's no need to hoist
// this into a "fetch once per grid" wrapper — the cache does that for free.
const STALE_TIME = Infinity

/** Browse registered, active collections. */
export function useCollections() {
    return useQuery({
        queryKey: ['collections', 'list'],
        staleTime: STALE_TIME,
        queryFn: async (): Promise<Collection[]> => {
            const { data, error } = await supabaseBrowser()
                .from('collections')
                .select('*')
                .eq('active', true)
                .order('registered_at', { ascending: false })
            if (error) throw error
            return data
        },
    })
}

/** Single collection lookup — null if `contract` isn't registered (or isn't active). */
export function useCollectionConfig(contract: string | undefined) {
    return useQuery({
        queryKey: ['collections', 'one', contract?.toLowerCase()],
        enabled: Boolean(contract),
        staleTime: STALE_TIME,
        queryFn: async (): Promise<Collection | null> => {
            const { data, error } = await supabaseBrowser()
                .from('collections')
                .select('*')
                .eq('contract', contract!.toLowerCase())
                .eq('active', true)
                .maybeSingle()
            if (error) throw error
            return data
        },
    })
}

interface RegisterCollectionInput {
    contract: string
    chainId: number
    name: string
    displayName?: string
    gateway?: string
}

export function useRegisterCollection() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (input: RegisterCollectionInput) => {
            const res = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `request failed: ${res.status}`)
            }
            return res.json() as Promise<Collection>
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
    })
}
