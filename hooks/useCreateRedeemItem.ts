'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import type { RedeemKind, RedeemTier } from '@/types/redeem'

export interface CreateRedeemItemInput {
    tier: RedeemTier
    kind: RedeemKind
    name: string
    description: string
    image_urls: string[]
    price_points: string // base units
    payment_token?: string
    payment_token_symbol?: string
    payment_amount?: string // base units
    payout_wallet?: string
    nft_contract?: string
    nft_token_id?: string
    stock?: number | null
    thailand_only?: boolean
    max_per_wallet?: number | null
    variants?: { label: string; sku?: string; stock?: number | null }[]
    publish_at?: string
    redeem_start_at?: string
    redeem_end_at?: string
}

/** STEP 1 — creating a listing is off-chain (a DB insert, gated by a live on-chain role check
 *  server-side); the NFT vault deposit itself is a separate on-chain tx the lister does beforehand
 *  with their own wallet (transferring to RedeemNftSettlement's treasury). */
export function useCreateRedeemItem() {
    const queryClient = useQueryClient()
    const chainId = useChainId()
    return useMutation({
        mutationFn: async (input: CreateRedeemItemInput) => {
            const res = await fetch('/api/redeem/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...input, chainId }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `listing failed: ${res.status}`)
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['redeem-items'] })
        },
    })
}
