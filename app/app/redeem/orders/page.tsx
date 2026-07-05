'use client'

import { Package, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { RedemptionStatusTracker } from '@/components/redeem/redemption-status-tracker'
import { useMockRedemptions } from '@/store/mock-redemptions'

export default function MyRedemptionsPage() {
    const orders = useMockRedemptions((s) => s.orders)

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">My Redemptions</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    NFT redemptions settle on-chain instantly. Merch redemptions are verified by
                    the team before shipping — track each step here.
                </p>
            </div>

            {orders.length === 0 ? (
                <EmptyState
                    title="No redemptions yet"
                    description="Items you redeem will show up here with their verification and shipping status."
                />
            ) : (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <Card key={o.id}>
                            <CardContent className="space-y-3 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {o.kind === 'nft' ? (
                                            <Sparkles className="h-4 w-4 text-primary" />
                                        ) : (
                                            <Package className="h-4 w-4 text-primary" />
                                        )}
                                        <span className="font-medium">{o.itemName}</span>
                                        <Badge variant="outline" className="capitalize">
                                            {o.tier}
                                        </Badge>
                                    </div>
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {o.pricePoints.toLocaleString()} PTS +{' '}
                                        {o.priceToken.toLocaleString()} {o.tokenSymbol}
                                    </span>
                                </div>

                                <RedemptionStatusTracker status={o.status} />

                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span>
                                        Ordered {new Date(o.createdAt).toLocaleDateString('en-GB')}
                                        {o.shipping && ` · Ships to ${o.shipping.fullName}`}
                                    </span>
                                    {o.trackingNumber && (
                                        <span className="font-mono">
                                            Tracking: {o.trackingNumber}
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
