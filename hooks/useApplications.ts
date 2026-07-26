'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import type {
    Application,
    ApplicationKind,
    ApplicationStatus,
    AuthorizeRwaPayload,
    PartnerApplicationPayload,
} from '@/types/applications'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init)
    if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `request failed: ${res.status}`)
    }
    return res.json()
}

/** The connected wallet's own applications, optionally filtered to one kind. */
export function useMyApplications(kind?: ApplicationKind) {
    const { address, isConnected } = useAccount()
    return useQuery({
        queryKey: ['applications', 'mine', address, kind],
        enabled: isConnected,
        queryFn: () => fetchJson<Application[]>(`/api/applications${kind ? `?kind=${kind}` : ''}`),
    })
}

interface SubmitApplicationInput {
    kind: ApplicationKind
    payload: AuthorizeRwaPayload | PartnerApplicationPayload
}

export function useSubmitApplication() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ kind, payload }: SubmitApplicationInput) =>
            fetchJson<Application>('/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, payload }),
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    })
}

/** Admin queue — pending (or any status) applications of one kind. */
export function useAdminApplications(kind: ApplicationKind, status: ApplicationStatus = 'pending') {
    return useQuery({
        queryKey: ['applications', 'admin', kind, status],
        queryFn: () => fetchJson<Application[]>(`/api/admin/applications?kind=${kind}&status=${status}`),
    })
}

/** Audit-trail-only status flip — does not itself grant anything, see route handler comment. */
export function useReviewApplication() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, status, rejectReason }: { id: string; status: 'approved' | 'rejected'; rejectReason?: string }) =>
            fetchJson<Application>('/api/admin/applications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, rejectReason }),
            }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    })
}
