'use client'

import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAddress } from '@/lib/utils'
import { toastError, toastSuccess } from '@/lib/toast'

interface ContentReport {
    id: string
    created_at: string
    reporter_wallet: string
    subject_type: string
    subject_id: string
    reason: string
    detail: string | null
}

function useReports() {
    return useQuery({
        queryKey: ['content-reports', 'open'],
        queryFn: async (): Promise<ContentReport[]> => {
            const res = await fetch('/api/admin/reports?status=open')
            if (!res.ok) throw new Error(`failed to load reports: ${res.status}`)
            return res.json()
        },
    })
}

function useResolveReport() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, status }: { id: string; status: 'actioned' | 'dismissed' }) => {
            const res = await fetch('/api/admin/reports', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `failed: ${res.status}`)
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-reports'] }),
    })
}

/** Reports don't act on anything by themselves — an admin still uses the Airdrops tab (or the edit
 *  page) to change content. Resolving here only records the triage decision. */
export function ReportQueue() {
    const { data: reports, isLoading } = useReports()
    const resolve = useResolveReport()

    if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
    if (!reports || reports.length === 0) {
        return <EmptyState title="No open reports" description="Content reported by users will appear here." />
    }

    const act = async (id: string, status: 'actioned' | 'dismissed') => {
        try {
            await resolve.mutateAsync({ id, status })
            toastSuccess(status === 'actioned' ? 'Marked as actioned' : 'Report dismissed')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Could not update report')
        }
    }

    return (
        <div className="space-y-3">
            {reports.map((report) => (
                <Card key={report.id}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge variant="destructive">{report.reason}</Badge>
                                <span className="text-xs text-muted-foreground">
                                    by {formatAddress(report.reporter_wallet)} ·{' '}
                                    {new Date(report.created_at).toLocaleString()}
                                </span>
                            </div>
                            {report.detail && <p className="text-sm">{report.detail}</p>}
                            {report.subject_type === 'airdrop_campaign' ? (
                                <Link
                                    href={`/app/airdrop/${report.subject_id}`}
                                    className="block truncate font-mono text-xs underline underline-offset-2"
                                >
                                    {report.subject_id}
                                </Link>
                            ) : (
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                    {report.subject_type} · {report.subject_id}
                                </p>
                            )}
                        </div>

                        <div className="flex shrink-0 gap-2">
                            <Button variant="outline" size="sm" onClick={() => act(report.id, 'actioned')}>
                                Actioned
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => act(report.id, 'dismissed')}>
                                Dismiss
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
