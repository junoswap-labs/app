'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useChainId } from 'wagmi'

export interface AirdropCampaignMetadata {
    title: string
    description: string
    cover_image_url: string | null
    visibility: 'public' | 'unlisted'
    location_restricted: boolean
    location_lat: number | null
    location_lng: number | null
    location_radius_m: number | null
    ip_dedupe_enabled: boolean
}

/** Only the off-chain columns are editable — everything the contract owns (token, amounts,
 *  claimant cap, expiry, gas mode) is fixed at creation and can't be changed by any route. */
export function useUpdateAirdropCampaign(campaignId: string) {
    const queryClient = useQueryClient()
    const chainId = useChainId()
    return useMutation({
        mutationFn: async (metadata: AirdropCampaignMetadata) => {
            const res = await fetch(`/api/airdrop/campaigns/${campaignId}/metadata`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...metadata, chainId }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `saving changes failed: ${res.status}`)
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns'] })
        },
    })
}
