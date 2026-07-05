'use client'

import Link from 'next/link'
import { ImageOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RwaListing } from '@/types/rwa'

const STATUS_LABEL: Partial<Record<RwaListing['status'], string>> = {
    funded: 'IN ESCROW',
    shipped: 'SHIPPED',
    completed: 'SOLD',
    disputed: 'DISPUTED',
}

export function RwaCard({ listing }: { listing: RwaListing }) {
    const overlay = STATUS_LABEL[listing.status]

    return (
        <Link href={`/app/rwa/${listing.id}`} className="group block">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative aspect-square bg-muted">
                    {listing.imageUrls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={listing.imageUrls[0]}
                            alt={listing.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageOff className="h-6 w-6" />
                        </div>
                    )}
                    {overlay && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <Badge variant="secondary">{overlay}</Badge>
                        </div>
                    )}
                </div>

                <CardContent className="space-y-1 p-3">
                    <span className="block truncate text-sm font-medium">{listing.title}</span>
                    <span className="text-sm font-semibold tabular-nums">
                        {listing.price}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                            {listing.paymentToken}
                        </span>
                    </span>
                </CardContent>
            </Card>
        </Link>
    )
}
