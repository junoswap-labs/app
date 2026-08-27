'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'

interface ListerProfile {
    lister_display_name: string | null
    lister_logo_url: string | null
}

/** The connected wallet's own "List By" branding — see app/api/redeem/lister-profile. */
export function useMyListerProfile() {
    return useQuery({
        queryKey: ['lister-profile', 'mine'],
        queryFn: async (): Promise<ListerProfile> => {
            const res = await fetch('/api/redeem/lister-profile')
            if (!res.ok) throw new Error(`failed to load lister profile: ${res.status}`)
            return res.json()
        },
    })
}

export function useUpdateListerProfile() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (input: ListerProfile) => {
            const res = await fetch('/api/redeem/lister-profile', {
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lister-profile'] })
            queryClient.invalidateQueries({ queryKey: ['lister-profiles'] })
        },
    })
}

/** Batch "List By" lookup for a set of Registered listers shown on a catalog/detail page — reads
 *  the redeem_lister_profiles view (public, 3 safe columns only — see
 *  supabase/migrations/0008_redeem_schema.sql), never the `users` table directly. */
export function useListerProfiles(wallets: string[]) {
    const unique = Array.from(new Set(wallets.filter(Boolean))).sort()
    return useQuery({
        queryKey: ['lister-profiles', unique],
        enabled: unique.length > 0,
        queryFn: async (): Promise<Record<string, ListerProfile>> => {
            const { data, error } = await supabaseBrowser().from('redeem_lister_profiles').select('*').in('wallet_address', unique)
            if (error) throw error
            const byWallet: Record<string, ListerProfile> = {}
            for (const row of data ?? []) {
                byWallet[row.wallet_address] = { lister_display_name: row.lister_display_name, lister_logo_url: row.lister_logo_url }
            }
            return byWallet
        },
    })
}
