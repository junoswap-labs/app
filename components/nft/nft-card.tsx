'use client'

import Link from 'next/link'
import { BadgeCheck, ImageOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCollectionConfig } from '@/hooks/useCollections'
import { optimizeImage } from '@/lib/image'
import type { NftListing } from '@/types/marketplace'

interface NftCardProps {
    listing: NftListing
}

// Browse card — renders from the denormalized listing (name/imageUrl/price), no chain reads.
// Click → detail page
export function NftCard({ listing }: NftCardProps) {
    const { data: config } = useCollectionConfig(listing.contract)
    const verified = config?.verified ?? false
    const href = `/app/nft/${listing.orderHash}`
    const sold = listing.status === 'sold'

    return (
        <Link href={href} className="group block">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative aspect-square bg-muted">
                    {listing.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={optimizeImage(listing.imageUrl, { width: 400 }) ?? undefined}
                            alt={listing.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                            onError={(e) => {
                                const img = e.currentTarget
                                if (img.dataset.fallback || !listing.imageUrl) return
                                img.dataset.fallback = '1'
                                img.src = listing.imageUrl
                            }}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageOff className="h-6 w-6" />
                        </div>
                    )}
                    {sold && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <Badge variant="secondary">SOLD</Badge>
                        </div>
                    )}
                </div>

                <CardContent className="space-y-1 p-3">
                    <div className="flex items-center gap-1">
                        <span className="truncate text-sm font-medium">{listing.name}</span>
                        {verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                    </div>
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold tabular-nums">
                            {listing.price}{' '}
                            <span className="text-xs font-normal text-muted-foreground">
                                {listing.paymentToken}
                            </span>
                        </span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
