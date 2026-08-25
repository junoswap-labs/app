'use client'

import Link from 'next/link'
import { useChainId } from 'wagmi'
import { ImageOff, Package, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ListedBy } from '@/components/redeem/listed-by'
import { redeemPriceLabel } from '@/lib/redeem-format'
import type { RedeemItem } from '@/types/redeem'

interface ListerProfile {
    lister_display_name: string | null
    lister_logo_url: string | null
}

export function RedeemItemCard({ item, listerProfile }: { item: RedeemItem; listerProfile?: ListerProfile }) {
    const chainId = useChainId()
    const soldOut = item.stock === 0 || (item.variants?.length ? item.variants.every((v) => v.stock === 0) : false)
    // Only shown when every option has a finite count — if any option is unlimited (stock: null)
    // a single summed number would be misleading, so the per-variant breakdown stays detail-page-only.
    const variantStockTotal =
        item.variants?.length && item.variants.every((v) => v.stock !== null)
            ? item.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
            : null

    return (
        <Link href={`/app/redeem/${item.id}`} className="block">
            <Card className="overflow-hidden transition-colors hover:border-primary/50">
                <div className="relative aspect-square bg-muted">
                    {item.image_urls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={item.image_urls[0]}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageOff className="h-6 w-6" />
                        </div>
                    )}
                    <Badge variant="secondary" className="absolute left-2 top-2">
                        {item.kind === 'nft' ? <Sparkles className="mr-1 h-3 w-3" /> : <Package className="mr-1 h-3 w-3" />}
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
                    <ListedBy tier={item.tier} listerWallet={item.lister_wallet} profile={listerProfile} />
                    <p className="text-sm font-semibold tabular-nums">
                        {redeemPriceLabel(item, chainId, item.payment_token)}
                    </p>
                    {item.stock !== null && !soldOut && <p className="text-xs text-muted-foreground">{item.stock} left</p>}
                    {variantStockTotal !== null && !soldOut && <p className="text-xs text-muted-foreground">{variantStockTotal} left</p>}
                </CardContent>
            </Card>
        </Link>
    )
}
