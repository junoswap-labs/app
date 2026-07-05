'use client'

import { ImageOff, Package, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RedeemItem } from '@/types/redeem'

export function RedeemItemCard({
    item,
    onRedeem,
}: {
    item: RedeemItem
    onRedeem: (item: RedeemItem) => void
}) {
    const soldOut = item.stock === 0

    return (
        <Card className="overflow-hidden">
            <div className="relative aspect-square bg-muted">
                {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageOff className="h-6 w-6" />
                    </div>
                )}
                <Badge variant="secondary" className="absolute left-2 top-2">
                    {item.kind === 'nft' ? (
                        <Sparkles className="mr-1 h-3 w-3" />
                    ) : (
                        <Package className="mr-1 h-3 w-3" />
                    )}
                    {item.kind === 'nft' ? 'NFT' : 'Merch'}
                </Badge>
                {soldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Badge variant="secondary">SOLD OUT</Badge>
                    </div>
                )}
            </div>

            <CardContent className="space-y-2 p-3">
                <div>
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold tabular-nums">
                        {item.pricePoints.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-muted-foreground">PTS</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                        + {item.priceToken.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                            {item.tokenSymbol}
                        </span>
                    </span>
                </div>
                {item.stock !== null && !soldOut && (
                    <p className="text-xs text-muted-foreground">{item.stock} left</p>
                )}
                <Button
                    size="sm"
                    className="w-full"
                    disabled={soldOut}
                    onClick={() => onRedeem(item)}
                >
                    Redeem
                </Button>
            </CardContent>
        </Card>
    )
}
