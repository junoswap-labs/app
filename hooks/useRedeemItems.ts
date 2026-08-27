'use client'

import { useQuery } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { RedeemItem, RedeemKind, RedeemTier } from '@/types/redeem'

/** Published catalog only — reads straight from Supabase (public-read RLS policy, see
 *  supabase/migrations/0008_redeem_schema.sql), same convention as useRwaListings.ts. */
export function useRedeemItems(filter?: { tier?: RedeemTier; kind?: RedeemKind }) {
    const chainId = useChainId()
    const query = useQuery({
        queryKey: ['redeem-items', chainId, filter?.tier, filter?.kind],
        staleTime: 15_000,
        queryFn: async (): Promise<RedeemItem[]> => {
            let q = supabaseBrowser()
                .from('redeem_items')
                .select('*, redeem_item_variants(*)')
                .eq('chain_id', chainId)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
            if (filter?.tier) q = q.eq('tier', filter.tier)
            if (filter?.kind) q = q.eq('kind', filter.kind)
            const { data, error } = await q
            if (error) throw error
            return (data ?? []).map((row) => ({
                ...row,
                variants: (row as unknown as { redeem_item_variants: RedeemItem['variants'] }).redeem_item_variants,
            })) as RedeemItem[]
        },
    })
    return query
}

export function useRedeemItem(id: number | string | undefined) {
    const numericId = id != null ? Number(id) : undefined
    const chainId = useChainId()
    return useQuery({
        queryKey: ['redeem-item', chainId, numericId],
        enabled: numericId != null && Number.isFinite(numericId),
        queryFn: async (): Promise<RedeemItem | null> => {
            const { data, error } = await supabaseBrowser()
                .from('redeem_items')
                .select('*, redeem_item_variants(*)')
                .eq('id', numericId as number)
                .eq('chain_id', chainId)
                .eq('status', 'published')
                .maybeSingle()
            if (error) throw error
            if (!data) return null
            return {
                ...data,
                variants: (data as unknown as { redeem_item_variants: RedeemItem['variants'] }).redeem_item_variants,
            } as RedeemItem
        },
    })
}

/** The connected wallet's own listings (including drafts) — needs the Route Handler, not the
 *  public-read policy, since drafts aren't publicly visible. */
export function useMyRedeemItems() {
    const chainId = useChainId()
    return useQuery({
        queryKey: ['redeem-items', 'mine', chainId],
        queryFn: async (): Promise<RedeemItem[]> => {
            const res = await fetch(`/api/redeem/items?chainId=${chainId}`)
            if (!res.ok) throw new Error(`failed to load your listings: ${res.status}`)
            return res.json()
        },
    })
}

/** A single owned listing regardless of status (draft/published/archived) — for the edit form.
 *  Unlike useRedeemItem, this goes through the Route Handler (own-listing check), not the
 *  public-read policy, since a draft/archived item isn't publicly selectable. */
export function useMyRedeemItem(id: number | string | undefined) {
    const numericId = id != null ? Number(id) : undefined
    return useQuery({
        queryKey: ['redeem-items', 'mine', numericId],
        enabled: numericId != null && Number.isFinite(numericId),
        queryFn: async (): Promise<RedeemItem> => {
            const res = await fetch(`/api/redeem/items/${numericId}`)
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `failed to load listing: ${res.status}`)
            }
            return res.json()
        },
    })
}
