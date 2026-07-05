'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useMockRedemptions } from '@/store/mock-redemptions'
import { toastSuccess } from '@/lib/toast'
import type { RedemptionOrder } from '@/types/redeem'

// Admin verification queue for merch (RWA) redemptions:
// submitted → verify payment + shipping data → verified → attach tracking → shipped.
// In the real flow these actions hit admin endpoints; status still comes back via the poller.
export function RedemptionQueue() {
    const orders = useMockRedemptions((s) => s.orders)
    const setStatus = useMockRedemptions((s) => s.setStatus)
    const [tracking, setTracking] = useState<Record<string, string>>({})

    const actionable = orders.filter((o) =>
        ['submitted', 'verified', 'shipped'].includes(o.status)
    )

    if (actionable.length === 0) {
        return (
            <EmptyState
                title="No redemptions to process"
                description="Merch redemptions awaiting verification or shipping will appear here."
            />
        )
    }

    const renderActions = (o: RedemptionOrder) => {
        switch (o.status) {
            case 'submitted':
                return (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={() => {
                                setStatus(o.id, 'verified')
                                toastSuccess(`${o.itemName} verified (mock)`)
                            }}
                        >
                            Verify
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                                setStatus(o.id, 'rejected')
                                toastSuccess(`${o.itemName} rejected (mock)`)
                            }}
                        >
                            Reject
                        </Button>
                    </div>
                )
            case 'verified':
                return (
                    <div className="flex gap-2">
                        <Input
                            placeholder="Tracking number"
                            className="h-8 w-44"
                            value={tracking[o.id] ?? ''}
                            onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })}
                        />
                        <Button
                            size="sm"
                            disabled={!tracking[o.id]?.trim()}
                            onClick={() => {
                                setStatus(o.id, 'shipped', tracking[o.id].trim())
                                toastSuccess(`${o.itemName} marked shipped (mock)`)
                            }}
                        >
                            Mark shipped
                        </Button>
                    </div>
                )
            case 'shipped':
                return (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setStatus(o.id, 'completed')
                            toastSuccess(`${o.itemName} completed (mock)`)
                        }}
                    >
                        Mark completed
                    </Button>
                )
            default:
                return null
        }
    }

    return (
        <div className="space-y-3">
            {actionable.map((o) => (
                <Card key={o.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{o.itemName}</span>
                                <Badge variant="secondary" className="capitalize">
                                    {o.status}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {o.pricePoints.toLocaleString()} PTS +{' '}
                                {o.priceToken.toLocaleString()} {o.tokenSymbol}
                                {o.shipping &&
                                    ` · ${o.shipping.fullName}, ${o.shipping.phone} — ${o.shipping.address}`}
                            </p>
                        </div>
                        {renderActions(o)}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
