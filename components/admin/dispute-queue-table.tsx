'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useRwaListings } from '@/hooks/useRwaListings'
import { useResolveDispute } from '@/hooks/useRwaActions'
import { toastSuccess, toastError } from '@/lib/toast'

function shortAddr(addr?: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—'
}

// Arbitrator queue — resolveDispute(listingId, releaseToSeller) on-chain, gated by
// ARBITRATOR_ROLE (this component's own gating is UX only; the contract enforces it for real —
// a non-arbitrator's tx would simply revert).
export function DisputeQueueTable() {
    const listings = useRwaListings().filter((l) => l.status === 'disputed')
    const resolveDispute = useResolveDispute()
    const [busyId, setBusyId] = useState<string | null>(null)

    if (listings.length === 0) {
        return (
            <EmptyState
                title="No open disputes"
                description="Disputed RWA orders requiring arbitration will appear here."
            />
        )
    }

    const resolve = async (id: string, releaseToSeller: boolean) => {
        setBusyId(id)
        try {
            await resolveDispute.resolveDisputeAsync(id as `0x${string}`, releaseToSeller)
            toastSuccess(releaseToSeller ? 'Escrow released to seller' : 'Escrow refunded to buyer')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Resolution failed')
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="space-y-3">
            {listings.map((l) => (
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
