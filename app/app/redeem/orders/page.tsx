'use client'

import Link from 'next/link'
import { useAccount, useChainId } from 'wagmi'
import { Package, Sparkles, ImageOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { RedemptionStatusTracker } from '@/components/redeem/redemption-status-tracker'
import { RedemptionAutoReleasePanel } from '@/components/redeem/redemption-auto-release'
import { useMyRedeemOrders } from '@/hooks/useRedeemOrders'
import { redeemPriceLabel } from '@/lib/redeem-format'

export default function MyRedemptionsPage() {
    const { isConnected } = useAccount()
    const { data: orders, isLoading, isError, error } = useMyRedeemOrders()
    const chainId = useChainId()

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <Breadcrumb items={[{ label: 'Redeem', href: '/app/redeem' }, { label: 'My Redemptions' }]} />
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">My Redemptions</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    NFT redemptions settle on-chain instantly. Merch redemptions ship from the lister —
                    confirm receipt within 10 days of shipping, or request a 7-day extension for slow
                    or international shipping.
                </p>
            </div>

            {isLoading ? null : !isConnected ? (
                <EmptyState
                    title="Connect your wallet"
                    description="Your redemptions are tied to your wallet address."
                />
            ) : isError ? (
                <EmptyState
                    title="Couldn't load your redemptions"
                    description={error instanceof Error ? error.message : 'Something went wrong — try refreshing the page.'}
                />
            ) : !orders || orders.length === 0 ? (
                <EmptyState
                    title="No redemptions yet"
                    description="Items you redeem will show up here with their status and tracking."
                />
            ) : (
                <div className="space-y-3">
                    {orders.map((o) => (
                        <Card key={o.id}>
                            <CardContent className="space-y-3 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Link href={`/app/redeem/${o.item_id}`} className="flex items-center gap-2 hover:opacity-80">
                                        <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted">
                                            {o.item_image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={o.item_image_url} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                                    <ImageOff className="h-4 w-4" />
                                                </div>
                                            )}
                                        </div>
                                        {o.kind === 'nft' ? (
                                            <Sparkles className="h-4 w-4 text-primary" />
                                        ) : (
                                            <Package className="h-4 w-4 text-primary" />
                                        )}
                                        <span className="font-medium">{o.item_name ?? `Item #${o.item_id}`}</span>
                                        {o.variant_label && <span className="text-xs text-muted-foreground">{o.variant_label}</span>}
                                        <Badge variant="outline" className="capitalize">
                                            {o.tier}
                                        </Badge>
                                    </Link>
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {redeemPriceLabel(o, chainId, o.payment_token)}
                                    </span>
                                </div>

                                <RedemptionStatusTracker status={o.status} kind={o.kind} />

                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span>
                                        Ordered {new Date(o.created_at).toLocaleDateString('en-GB')}
                                        {o.shipping && ` · Ships to ${o.shipping.fullName}`}
                                    </span>
                                    {o.tracking_number && <span className="font-mono">Tracking: {o.tracking_number}</span>}
                                </div>

                                {o.status === 'Shipped' && o.escrow_listing_id && o.shipped_at && (
                                    <RedemptionAutoReleasePanel
                                        orderId={o.id}
                                        listingId={o.escrow_listing_id as `0x${string}`}
                                        shippedAt={o.shipped_at}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
