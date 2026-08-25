'use client'

import Link from 'next/link'
import { useChainId } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useMyRedeemItems } from '@/hooks/useRedeemItems'
import { redeemPriceLabel } from '@/lib/redeem-format'
import type { RedeemItemStatus } from '@/types/redeem'

const STATUS_VARIANT: Record<RedeemItemStatus, 'default' | 'secondary' | 'outline'> = {
    published: 'default',
    draft: 'outline',
    archived: 'secondary',
}

/** Lister's own Redeem items (any status) with an Edit link per row — the counterpart to
 *  RedemptionQueue (which manages orders, not the listings themselves). */
export function MyRedeemListings() {
    const chainId = useChainId()
    const { data: items, isLoading } = useMyRedeemItems()

    if (isLoading) return <p className="text-sm text-muted-foreground">Loading your listings…</p>

    if (!items || items.length === 0) {
        return (
            <EmptyState
                title="No listings yet"
                description="Items you list show up here so you can edit or unpublish them later."
                action={
                    <Button asChild>
                        <Link href="/app/redeem/list">List an item</Link>
                    </Button>
                }
            />
        )
    }

    return (
        <div className="space-y-3">
            {items.map((item) => (
                <Card key={item.id}>
                    <CardContent className="flex items-center gap-3 py-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                            {item.image_urls[0] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={item.image_urls[0]}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="truncate font-medium">{item.name}</p>
                                <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {item.tier === 'official' ? 'Official' : 'Registered'} · {item.kind === 'nft' ? 'NFT' : 'Merch'} ·{' '}
                                {redeemPriceLabel(item, chainId, item.payment_token)}
                            </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                            <Link href={`/app/redeem/manage/items/${item.id}`}>Edit</Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
