'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useRwaListings } from '@/hooks/useRwaListings'
import { useResolveDispute } from '@/hooks/useRwaActions'
import { useAdminRedeemOrders } from '@/hooks/useRedeemOrders'
import { useResolveRedeemDispute } from '@/hooks/useRedeemMerchActions'
import { toastSuccess, toastError } from '@/lib/toast'

function shortAddr(addr?: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—'
}

// Redeem merch disputes — separate section because they resolve against the Redeem-dedicated
// RwaEscrow deployment (see hooks/useRedeemMerchActions.ts), not the Marketplace one above, and
// carry a reason + evidence the Marketplace flow has no equivalent of (see report-dispute-dialog.tsx).
function RedeemDisputeQueue() {
    const orders = (useAdminRedeemOrders().data ?? []).filter((o) => o.status === 'Disputed')
    const resolveDispute = useResolveRedeemDispute()
    const [busyId, setBusyId] = useState<string | null>(null)

    if (orders.length === 0) return null

    const resolve = async (id: string, listingId: `0x${string}`, releaseToSeller: boolean) => {
        setBusyId(id)
        try {
            await resolveDispute.resolveDisputeAsync(listingId, releaseToSeller)
            toastSuccess(releaseToSeller ? 'Escrow released to lister' : 'Escrow refunded to buyer')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Resolution failed')
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Redeem merch</p>
            {orders.map((o) => (
                <Card key={o.id}>
                    <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{o.item_name ?? `Item #${o.item_id}`}</span>
                                    <Badge variant="secondary">DISPUTED</Badge>
                                    <Badge variant="outline">{o.dispute_reason === 'fake_shipment' ? 'Item not received' : 'Buyer unresponsive'}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">Buyer {shortAddr(o.buyer_wallet)}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    disabled={busyId !== null || !o.escrow_listing_id}
                                    isLoading={busyId === o.id}
                                    loadingText="Confirming…"
                                    onClick={() => resolve(o.id, o.escrow_listing_id as `0x${string}`, true)}
                                >
                                    Release to lister
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busyId !== null || !o.escrow_listing_id}
                                    onClick={() => resolve(o.id, o.escrow_listing_id as `0x${string}`, false)}
                                >
                                    Refund buyer
                                </Button>
                            </div>
                        </div>
                        {o.dispute_detail && <p className="text-sm">{o.dispute_detail}</p>}
                        {o.dispute_evidence_urls && o.dispute_evidence_urls.length > 0 && (
                            <div className="flex gap-2">
                                {o.dispute_evidence_urls.map((url) => (
                                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt="Dispute evidence" className="h-16 w-16 rounded-md border object-cover" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

// Arbitrator queue — resolveDispute(listingId, releaseToSeller) on-chain, gated by
// ARBITRATOR_ROLE (this component's own gating is UX only; the contract enforces it for real —
// a non-arbitrator's tx would simply revert).
function MarketplaceDisputeQueue() {
    const listings = useRwaListings().filter((l) => l.status === 'disputed')
    const resolveDispute = useResolveDispute()
    const [busyId, setBusyId] = useState<string | null>(null)

    if (listings.length === 0) return null

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
            <p className="text-sm font-medium text-muted-foreground">Marketplace RWA</p>
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

export function DisputeQueueTable() {
    const marketplaceListings = useRwaListings().filter((l) => l.status === 'disputed')
    const redeemOrders = (useAdminRedeemOrders().data ?? []).filter((o) => o.status === 'Disputed')

    if (marketplaceListings.length === 0 && redeemOrders.length === 0) {
        return (
            <EmptyState
                title="No open disputes"
                description="Disputed orders requiring arbitration will appear here."
            />
        )
    }

    return (
        <div className="space-y-6">
            <MarketplaceDisputeQueue />
            <RedeemDisputeQueue />
        </div>
    )
}
