'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ImageOff, ReceiptText } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useListings } from '@/hooks/useListings'
import { useRwaListings } from '@/hooks/useRwaListings'
import { optimizeImage } from '@/lib/image'
import type { NftListing } from '@/types/marketplace'
import type { RwaListing } from '@/types/rwa'

interface OrderRow {
    key: string
    href: string
    kind: 'NFT' | 'RWA'
    name: string
    imageUrl: string | null
    price: string
    paymentToken: string
    status: string
    at: number
}

function nftRow(l: NftListing): OrderRow {
    return {
        key: `nft-${l.orderHash}`,
        href: `/app/nft/${l.orderHash}`,
        kind: 'NFT',
        name: l.name,
        imageUrl: l.imageUrl,
        price: l.price,
        paymentToken: l.paymentToken,
        status: l.status,
        at: l.soldAt ?? l.listedAt,
    }
}

function rwaRow(l: RwaListing): OrderRow {
    return {
        key: `rwa-${l.id}`,
        href: `/app/rwa/${l.id}`,
        kind: 'RWA',
        name: l.title,
        imageUrl: l.imageUrls[0] ?? null,
        price: l.price,
        paymentToken: l.paymentToken,
        status: l.status,
        at: l.fundedAt ?? l.createdAt,
    }
}

export default function OrdersPage() {
    const { address } = useAccount()
    const nftListings = useListings({ search: '', status: 'all', sort: 'recent' })
    const rwaListings = useRwaListings()
    const me = address?.toLowerCase()

    const purchases: OrderRow[] = me
        ? [
              ...nftListings.filter((l) => l.buyer?.toLowerCase() === me).map(nftRow),
              ...rwaListings.filter((l) => l.buyer?.toLowerCase() === me).map(rwaRow),
          ].sort((a, b) => b.at - a.at)
        : []

    const sales: OrderRow[] = me
        ? [
              ...nftListings.filter((l) => l.seller.toLowerCase() === me).map(nftRow),
              ...rwaListings.filter((l) => l.seller.toLowerCase() === me).map(rwaRow),
          ].sort((a, b) => b.at - a.at)
        : []

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">My Orders</h1>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/app/redeem/orders">
                        <ReceiptText className="mr-1.5 h-4 w-4" /> My Redemptions
                    </Link>
                </Button>
            </div>

            {!address ? (
                <EmptyState
                    title="Connect your wallet"
                    description="Your NFT and RWA orders are tied to your wallet address."
                />
            ) : (
                <Tabs defaultValue="purchases">
                    <TabsList>
                        <TabsTrigger value="purchases">Purchases</TabsTrigger>
                        <TabsTrigger value="sales">Sales</TabsTrigger>
                    </TabsList>

                    <TabsContent value="purchases" className="mt-6">
                        <OrderList
                            rows={purchases}
                            emptyTitle="No purchases yet"
                            emptyDescription="NFTs and RWA items you buy will show up here."
                        />
                    </TabsContent>

                    <TabsContent value="sales" className="mt-6">
                        <OrderList
                            rows={sales}
                            emptyTitle="No sales yet"
                            emptyDescription="Items you list for sale will show up here."
                        />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    )
}

function OrderList({
    rows,
    emptyTitle,
    emptyDescription,
}: {
    rows: OrderRow[]
    emptyTitle: string
    emptyDescription: string
}) {
    if (rows.length === 0) {
        return <EmptyState title={emptyTitle} description={emptyDescription} />
    }
    return (
        <div className="space-y-3">
            {rows.map((row) => (
                <Link key={row.key} href={row.href} className="block">
                    <Card className="transition-shadow hover:shadow-md">
                        <CardContent className="flex items-center gap-4 p-3">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                                {row.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={optimizeImage(row.imageUrl, { width: 112 }) ?? row.imageUrl}
                                        alt={row.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                        <ImageOff className="h-4 w-4" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">{row.name}</span>
                                    <Badge variant="outline">{row.kind}</Badge>
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {new Date(row.at).toLocaleDateString('en-GB')}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold tabular-nums">
                                    {row.price}{' '}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {row.paymentToken}
                                    </span>
                                </div>
                                <Badge variant="secondary" className="mt-1 capitalize">
                                    {row.status}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    )
}
