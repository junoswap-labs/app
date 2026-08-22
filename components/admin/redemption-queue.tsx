'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAdminRedeemOrders, useAttachTracking } from '@/hooks/useRedeemOrders'
import { useMarkRedeemShipped } from '@/hooks/useRedeemMerchActions'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { redeemPriceLabel } from '@/lib/redeem-format'
import { useChainId } from 'wagmi'
import type { RedemptionOrder } from '@/types/redeem'

/**
 * STEP 3 fulfillment queue — Admin sees every actionable merch order, a Registered lister sees only
 * orders against their own items (both enforced server-side by app/api/admin/redeem-orders, this
 * component doesn't need to know which case it's in). Reused as-is on the Admin "Redemptions" tab
 * and on the "Manage" tab of /app/redeem for partners — see app/app/redeem/page.tsx.
 */
export function RedemptionQueue() {
    const { data: orders, isLoading } = useAdminRedeemOrders()
    const attachTracking = useAttachTracking()
    const markShipped = useMarkRedeemShipped()
    const { run, isPending } = useAsyncAction<string>()
    const chainId = useChainId()
    const [tracking, setTracking] = useState<Record<string, string>>({})

    if (isLoading) return null

    if (!orders || orders.length === 0) {
        return (
            <EmptyState
                title="No redemptions to process"
                description="Merch redemptions awaiting shipment or in transit will appear here."
            />
        )
    }

    const shipOrder = (o: RedemptionOrder) => {
        const trackingNumber = (tracking[o.id] ?? '').trim()
        if (!trackingNumber || !o.escrow_listing_id) return
        run(
            o.id,
            async () => {
                await attachTracking.mutateAsync({ orderId: o.id, trackingNumber })
                await markShipped.markShippedAsync(o.escrow_listing_id as `0x${string}`)
            },
            `${o.item_name ?? 'Order'} marked shipped`
        )
    }

    return (
        <div className="space-y-3">
            {orders.map((o) => (
                <Card key={o.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">
                                    {o.item_name ?? `Item #${o.item_id}`}
                                    {o.variant_label && ` — ${o.variant_label}`}
                                </span>
                                <Badge variant="secondary">{o.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {redeemPriceLabel(o, chainId, o.payment_token)}
                                {o.shipping && ` · ${o.shipping.fullName}, ${o.shipping.phone} — ${o.shipping.address}`}
                            </p>
                        </div>

                        {o.status === 'Funded' && (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Tracking number"
                                    className="h-8 w-44"
                                    value={tracking[o.id] ?? ''}
                                    onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })}
                                />
                                <Button
                                    size="sm"
                                    disabled={!tracking[o.id]?.trim() || isPending(o.id)}
                                    isLoading={isPending(o.id)}
                                    loadingText="Confirming…"
                                    onClick={() => shipOrder(o)}
                                >
                                    Mark shipped
                                </Button>
                            </div>
                        )}

                        {o.status === 'Shipped' && (
                            <div className="text-xs text-muted-foreground">
                                {o.tracking_number ? `Tracking: ${o.tracking_number}` : 'Awaiting buyer confirmation'}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
