'use client'

import { useQuery } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { AirdropCampaign, AirdropClaim } from '@/types/airdrop'

/** The Browse Airdrops page's feed — public campaigns only. Creators see their own unlisted
 *  campaigns too, but only on /app/airdrop/manage (useMyAirdropCampaigns below). */
export function useAirdropCampaigns() {
    return useQuery({
        queryKey: ['airdrop-campaigns'],
        staleTime: 15_000,
        queryFn: async (): Promise<AirdropCampaign[]> => {
            const { data, error } = await supabaseBrowser()
                .from('airdrop_campaigns')
                .select('*')
                .eq('visibility', 'public')
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        },
    })
}

/** Resolves a shared QR/link token to its campaign via the Route Handler (service-role read,
 *  since this needs to work for unlisted campaigns too — see app/api/airdrop/campaigns/by-share). */
export function useAirdropCampaignByShareHash(shareHash: string | undefined) {
    return useQuery({
        queryKey: ['airdrop-campaigns', 'share', shareHash],
        enabled: !!shareHash,
        staleTime: 15_000,
        queryFn: async (): Promise<AirdropCampaign | null> => {
            const res = await fetch(`/api/airdrop/campaigns/by-share/${shareHash}`)
            if (res.status === 404) return null
            if (!res.ok) throw new Error(`failed to resolve share link: ${res.status}`)
            return res.json()
        },
    })
}

export function useAirdropCampaign(id: string | undefined) {
    return useQuery({
        queryKey: ['airdrop-campaigns', id],
        enabled: !!id,
        staleTime: 10_000,
        queryFn: async (): Promise<AirdropCampaign | null> => {
            const { data, error } = await supabaseBrowser()
                .from('airdrop_campaigns')
                .select('*')
                .eq('id', id as string)
                .maybeSingle()
            if (error) throw error
            return data
        },
    })
}

export function useMyAirdropCampaigns(wallet: string | undefined) {
    return useQuery({
        queryKey: ['airdrop-campaigns', 'creator', wallet],
        enabled: !!wallet,
        staleTime: 15_000,
        queryFn: async (): Promise<AirdropCampaign[]> => {
            const { data, error } = await supabaseBrowser()
                .from('airdrop_campaigns')
                .select('*')
                .eq('creator_wallet', wallet as string)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        },
    })
}

/** Recent claims for one campaign — also doubles as the public "live claim feed". */
export function useAirdropClaims(campaignId: string | undefined) {
    return useQuery({
        queryKey: ['airdrop-claims', campaignId],
        enabled: !!campaignId,
        staleTime: 5_000,
        queryFn: async (): Promise<AirdropClaim[]> => {
            const { data, error } = await supabaseBrowser()
                .from('airdrop_claims')
                .select('*')
                .eq('campaign_id', campaignId as string)
                .order('claimed_at', { ascending: false })
                .limit(50)
            if (error) throw error
            return data
        },
    })
}
