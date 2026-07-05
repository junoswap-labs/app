'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useMockRwa } from '@/store/mock-rwa'
import { mockTx } from '@/lib/mock/tx'
import { toastSuccess } from '@/lib/toast'

function shortAddr(addr?: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—'
}

// Arbitrator queue — real flow: resolveDispute(listingId, releaseToSeller) on-chain,
// gated by ARBITRATOR_ROLE (client check is UX only; the contract enforces it).
export function DisputeQueueTable() {
    const listings = useMockRwa((s) => s.listings)
    const update = useMockRwa((s) => s.update)
    const [busyId, setBusyId] = useState<string | null>(null)

    const disputed = listings.filter((l) => l.status === 'disputed')

    if (disputed.length === 0) {
        return (
            <EmptyState
                title="No open disputes"
                description="Disputed RWA orders requiring arbitration will appear here."
            />
        )
    }

    const resolve = async (id: string, releaseToSeller: boolean) => {
        setBusyId(id)
        await mockTx()
        update(id, { status: 'resolved', resolvedToSeller: releaseToSeller })
        setBusyId(null)
        toastSuccess(
            releaseToSeller ? 'Escrow released to seller (mock)' : 'Escrow refunded to buyer (mock)'
        )
    }

    return (
        <div className="space-y-3">
            {disputed.map((l) => (
                <Card key={l.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{l.title}</span>
                                <Badge variant="secondary">DISPUTED</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {l.price} {l.paymentToken} · Seller {shortAddr(l.seller)} · Buyer{' '}
                                {shortAddr(l.buyer)}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                disabled={busyId !== null}
                                isLoading={busyId === l.id}
                                loadingText="Confirming…"
                                onClick={() => resolve(l.id, true)}
                            >
                                Release to seller
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId !== null}
                                onClick={() => resolve(l.id, false)}
                            >
                                Refund buyer
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
