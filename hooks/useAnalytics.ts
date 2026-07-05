'use client'

import { useQuery } from '@tanstack/react-query'
import type { AnalyticsResponse } from '@/types/analytics'

/** Fetch analytics from the admin endpoint; `token` = selected address (null = all tokens) */
export function useAnalytics(token: string | null) {
    return useQuery({
        queryKey: ['analytics', token],
        queryFn: async (): Promise<AnalyticsResponse> => {
            const qs = token ? `?token=${token}` : ''
            const res = await fetch(`/api/admin/analytics${qs}`)
            if (!res.ok) throw new Error(`analytics request failed: ${res.status}`)
            return res.json()
        },
    })
}
