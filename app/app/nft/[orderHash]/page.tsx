'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ArrowLeft, BadgeCheck, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { BuyNftDialog } from '@/components/nft/buy-nft-dialog'
import { useListing } from '@/hooks/useListings'
import { useMockListings } from '@/store/mock-listings'
import { getCollectionConfig } from '@/lib/nft-collections'
import { feeBreakdown } from '@/services/marketplace/fee'
import { optimizeImage } from '@/lib/image'
import { mockTx } from '@/lib/mock/tx'
import { toastSuccess } from '@/lib/toast'

// Route param is a composite `${contract}-${tokenId}` for now — it becomes the real
// EIP-712 orderHash once orders live in Supabase, so the route shape won't change.
function parseOrderHash(orderHash: string): { contract: string; tokenId: string } | null {
    const sep = orderHash.lastIndexOf('-')
    if (sep <= 0) return null
    return { contract: orderHash.slice(0, sep), tokenId: orderHash.slice(sep + 1) }
}

export default function NftOrderDetailPage({
    params,
}: {
    params: Promise<{ orderHash: string }>
}) {
    const { orderHash } = use(params)
    const parsed = parseOrderHash(decodeURIComponent(orderHash))
    const { address } = useAccount()
    const listing = useListing(parsed?.contract ?? '', parsed?.tokenId ?? '')
    const removeListing = useMockListings((s) => s.removeListing)
    const [cancelling, setCancelling] = useState(false)

    if (!parsed || !listing) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Order not found"
                    description="This listing doesn't exist or was removed."
                    action={
                        <Button asChild variant="outline">
                            <Link href="/app">Back to Marketplace</Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    const verified = getCollectionConfig(listing.contract)?.verified ?? false
    const isSeller = address?.toLowerCase() === listing.seller.toLowerCase()
    const fees = feeBreakdown(listing.price)

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                <Link href="/app">
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Marketplace
                </Link>
            </Button>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="overflow-hidden rounded-lg border bg-muted">
                    {listing.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={optimizeImage(listing.imageUrl, { width: 800 }) ?? listing.imageUrl}
                            alt={listing.name}
                            className="aspect-square h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex aspect-square items-center justify-center text-muted-foreground">
                            <ImageOff className="h-8 w-8" />
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {listing.name}
                            </h1>
                            {verified && <BadgeCheck className="h-5 w-5 text-primary" />}
                        </div>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {listing.contract} · #{listing.tokenId}
                        </p>
                    </div>

                    <div className="text-3xl font-semibold tabular-nums">
                        {listing.price}{' '}
                        <span className="text-base font-normal text-muted-foreground">
                            {listing.paymentToken}
                        </span>
                    </div>

                    <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Seller</span>
                            <span className="font-mono text-xs">
                                {listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}
                                {isSeller && ' (you)'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Marketplace fee (2%)</span>
                            <span className="tabular-nums">
                                {fees.fee.toLocaleString()} {listing.paymentToken}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Seller receives</span>
                            <span className="tabular-nums">
                                {fees.sellerReceives.toLocaleString()} {listing.paymentToken}
                            </span>
                        </div>
                    </div>

                    <Separator />

                    <BuyNftDialog listing={listing} />

                    {isSeller && listing.status === 'active' && (
                        <Button
                            variant="outline"
                            className="w-full"
                            isLoading={cancelling}
                            loadingText="Confirming on-chain…"
                            onClick={async () => {
                                // MOCK: real flow is an on-chain cancelOrder() tx → sync refresh
                                setCancelling(true)
                                await mockTx()
                                removeListing(listing.contract, listing.tokenId)
                                setCancelling(false)
                                toastSuccess('Listing cancelled (mock)')
                            }}
                        >
                            Cancel listing
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
