'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RedemptionOrder } from '@/types/redeem'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init)
    if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `request failed: ${res.status}`)
    }
    return res.json()
}

/** The connected wallet's own redemption orders — "My Redemptions". The route is session-gated, so
 *  callers that render before sign-in (the header bell) pass enabled=false to skip a certain 401. */
export function useMyRedeemOrders(enabled = true) {
    return useQuery({
        queryKey: ['redeem-orders', 'mine'],
        queryFn: () => fetchJson<RedemptionOrder[]>('/api/redeem/orders'),
        enabled,
    })
}

/** STEP 3 fulfillment queue — an Admin sees everything actionable; a Registered lister sees only
 *  orders against their own items (see app/api/admin/redeem-orders's route-level filtering). */
export function useAdminRedeemOrders() {
    return useQuery({
        queryKey: ['redeem-orders', 'admin-queue'],
        queryFn: () => fetchJson<RedemptionOrder[]>('/api/admin/redeem-orders'),
        refetchInterval: 30_000,
    })
}

export function useRedeemOrderLogs(orderId: string | undefined) {
    return useQuery({
        queryKey: ['redeem-order-logs', orderId],
        enabled: Boolean(orderId),
        queryFn: () => fetchJson(`/api/redeem/orders/${orderId}/logs`),
    })
}

/** Records dispute reason/evidence off-chain — see the route's own comment for why the actual
 *  openDispute() tx is a separate step the caller still has to send with their own wallet. */
export function useReportRedeemDispute() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ orderId, detail, evidenceUrls }: { orderId: string; detail: string; evidenceUrls: string[] }) =>
            fetchJson(`/api/redeem/orders/${orderId}/dispute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ detail, evidence_urls: evidenceUrls }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['redeem-orders'] })
        },
    })
}

/** STEP 3.1 — attach a tracking number (off-chain metadata only, see the route's own comment). */
export function useAttachTracking() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ orderId, trackingNumber }: { orderId: string; trackingNumber: string }) =>
            fetchJson(`/api/redeem/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tracking_number: trackingNumber }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['redeem-orders'] })
        },
    })
}
