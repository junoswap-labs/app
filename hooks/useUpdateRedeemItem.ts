'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RedeemItemStatus } from '@/types/redeem'

export interface UpdateRedeemItemInput {
    id: number
    name?: string
    description?: string
    image_urls?: string[]
    price_points?: string // base units
    payment_token?: string | null
    payment_token_symbol?: string | null
    payment_amount?: string | null // base units
    stock?: number | null
    publish_at?: string | null
    redeem_start_at?: string | null
    redeem_end_at?: string | null
    status?: RedeemItemStatus
    variants?: { id?: number; label: string; sku?: string | null; stock?: number | null }[]
}

/** Edits an existing Redeem item — own listing only (or Admin, server-enforced). Structural
 *  fields (tier/kind/nft_contract/nft_token_id) aren't editable, same as useCreateRedeemItem's
 *  create-time invariants. */
export function useUpdateRedeemItem() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, ...input }: UpdateRedeemItemInput) => {
            const res = await fetch(`/api/redeem/items/${id}`, {
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
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['redeem-items'] })
            queryClient.invalidateQueries({ queryKey: ['redeem-item', variables.id] })
        },
    })
}
