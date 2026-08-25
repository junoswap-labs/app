'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatAddress } from '@/lib/utils'

// ~5s blocks on kub, so a target more than this far behind is roughly an hour stale — past the
// point where a user creating something would notice their data missing.
const STALE_BLOCKS = 720n

interface SyncStatus {
    head: string
    contracts: { contract: string; lastBlock: string; behind: string }[]
}

interface AuditLog {
    id: string
    created_at: string
    category: string
    action: string
    actor_wallet: string | null
    subject_type: string | null
    subject_id: string | null
    metadata: Record<string, unknown> | null
}

const CATEGORIES = ['all', 'admin', 'sync', 'client', 'auth', 'bot'] as const

function SyncStatusCard() {
    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'sync-status'],
        refetchInterval: 60_000,
        queryFn: async (): Promise<SyncStatus> => {
            const res = await fetch('/api/admin/sync-status')
            if (!res.ok) throw new Error(`failed to load sync status: ${res.status}`)
            return res.json()
        },
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Chain sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {isLoading || !data ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                    <>
                        <p className="text-xs text-muted-foreground">Head block {data.head}</p>
                        {data.contracts.map((contract) => {
                            const behind = BigInt(contract.behind)
                            return (
                                <div key={contract.contract} className="flex items-center justify-between gap-3 text-sm">
                                    <span className="font-mono text-xs">{contract.contract}</span>
                                    <Badge variant={behind > STALE_BLOCKS ? 'destructive' : 'secondary'}>
                                        {behind <= 0n ? 'up to date' : `${contract.behind} blocks behind`}
                                    </Badge>
                                </div>
                            )
                        })}
                        <p className="text-xs text-muted-foreground">
                            A contract stuck far behind means the poller can&apos;t reach the head — check its deploy
                            block and the RPC before anything else.
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

function AuditLogViewer() {
    const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all')
    const { data: logs, isLoading } = useQuery({
        queryKey: ['admin', 'audit-logs', category],
        queryFn: async (): Promise<AuditLog[]> => {
            const res = await fetch(`/api/admin/audit-logs${category === 'all' ? '' : `?category=${category}`}`)
            if (!res.ok) throw new Error(`failed to load audit logs: ${res.status}`)
            return res.json()
        },
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Audit log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((value) => (
                        <Button
                            key={value}
                            size="sm"
                            variant={value === category ? 'default' : 'outline'}
                            onClick={() => setCategory(value)}
                        >
                            {value}
                        </Button>
                    ))}
                </div>

                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : !logs || logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing recorded in this category yet.</p>
                ) : (
                    <ul className="divide-y">
                        {logs.map((log) => (
                            <li key={log.id} className="py-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{log.category}</Badge>
                                    <span className="font-medium">{log.action}</span>
                                    <span className="text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString()}
                                    </span>
                                    {log.actor_wallet && (
                                        <span className="font-mono text-muted-foreground">
                                            {formatAddress(log.actor_wallet)}
                                        </span>
                                    )}
                                </div>
                                {log.subject_id && (
                                    <p className="truncate font-mono text-[11px] text-muted-foreground/80">
                                        {log.subject_type} · {log.subject_id}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}

export function SystemPanel() {
    return (
        <div className="space-y-4">
            <SyncStatusCard />
            <AuditLogViewer />
        </div>
    )
}
