'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useAccount, useChainId } from 'wagmi'
import { parseUnits } from 'viem'
import { ArrowLeft, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { OrderStatusTracker } from '@/components/rwa/order-status-tracker'
import { DeadlineCountdown } from '@/components/rwa/ship-deadline-countdown'
import { useRwaListing } from '@/hooks/useRwaListings'
import {
    useFundRwaOrder,
    useMarkShipped,
    useConfirmReceived,
    useClaimRefund,
    useOpenDispute,
    useClaimShipmentTimeout,
} from '@/hooks/useRwaActions'
import { useCancelRwaListing } from '@/hooks/useCancelRwaListing'
import { canPerform, roleFor } from '@/services/marketplace/rwa-order'
import { feeBreakdown } from '@/services/marketplace/fee'
import { findPaymentToken } from '@/lib/tokens'
import { toastSuccess, toastError } from '@/lib/toast'
import {
    SHIP_DEADLINE_MS,
    DISPUTE_GRACE_MS,
    AUTO_RELEASE_DEADLINE_MS,
    type RwaAction,
} from '@/types/rwa'

export default function RwaListingDetailPage({
    params,
}: {
    params: Promise<{ listingId: string }>
}) {
    const { listingId } = use(params)
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const listing = useRwaListing(decodeURIComponent(listingId))

    const fund = useFundRwaOrder()
    const markShipped = useMarkShipped()
    const confirmReceived = useConfirmReceived()
    const claimRefund = useClaimRefund()
    const openDispute = useOpenDispute()
    const claimShipmentTimeout = useClaimShipmentTimeout()
    const cancelListing = useCancelRwaListing()
    const [pendingAction, setPendingAction] = useState<RwaAction | null>(null)

    if (!listing) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Listing not found"
                    description="This RWA listing doesn't exist or was removed."
                    action={
                        <Button asChild variant="outline">
                            <Link href="/app">Back to Marketplace</Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    const role = roleFor(listing, address)
    const fees = feeBreakdown(listing.price)

    const run = async (action: RwaAction, doneMsg: string) => {
        if (!isConnected || !address) {
            toastError('Please connect your wallet first')
            return
        }
        setPendingAction(action)
        try {
            switch (action) {
                case 'fund': {
                    const token = findPaymentToken(chainId, listing.paymentTokenAddress)
                    if (!token) throw new Error('unknown payment token for this chain')
                    await fund.fundAsync(
                        listing.id as `0x${string}`,
                        listing.seller,
                        listing.paymentTokenAddress,
                        parseUnits(listing.price, token.decimals)
                    )
                    break
                }
                case 'markShipped':
                    await markShipped.markShippedAsync(listing.id as `0x${string}`)
                    break
                case 'confirmReceived':
                    await confirmReceived.confirmReceivedAsync(listing.id as `0x${string}`)
                    break
                case 'claimRefund':
                    await claimRefund.claimRefundAsync(listing.id as `0x${string}`)
                    break
                case 'openDispute':
                    await openDispute.openDisputeAsync(listing.id as `0x${string}`)
                    break
                case 'claimShipmentTimeout':
                    await claimShipmentTimeout.claimShipmentTimeoutAsync(listing.id as `0x${string}`)
                    break
                case 'cancel':
                    await cancelListing.mutateAsync(listing.id)
                    break
                default:
                    return
            }
            toastSuccess(doneMsg)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Transaction failed')
        } finally {
            setPendingAction(null)
        }
    }

    const actionButton = (
        action: RwaAction,
        label: string,
        doneMsg: string,
        variant: 'default' | 'outline' | 'destructive' = 'default'
    ) =>
        canPerform(listing, action, role) && (
            <Button
                key={action}
                variant={variant}
                isLoading={pendingAction === action}
                loadingText="Confirming on-chain…"
                disabled={pendingAction !== null}
                onClick={() => run(action, doneMsg)}
            >
                {label}
            </Button>
        )

    return (
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                <Link href="/app">
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Marketplace
                </Link>
            </Button>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="overflow-hidden rounded-lg border bg-muted">
                    {listing.imageUrls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={listing.imageUrls[0]}
                            alt={listing.title}
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
                        <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">{listing.description}</p>
                    </div>

                    <div className="text-3xl font-semibold tabular-nums">
                        {listing.price}{' '}
                        <span className="text-base font-normal text-muted-foreground">
                            {listing.paymentToken}
                        </span>
                    </div>

                    <Card>
                        <CardContent className="space-y-3 p-4">
                            <OrderStatusTracker status={listing.status} />
                            {listing.status === 'funded' && listing.fundedAt && (
                                <DeadlineCountdown
                                    deadline={listing.fundedAt + SHIP_DEADLINE_MS}
                                    label="Ship"
                                />
                            )}
                            {listing.status === 'shipped' && listing.shippedAt && (
                                <DeadlineCountdown
                                    deadline={listing.shippedAt + DISPUTE_GRACE_MS}
                                    label="Dispute window opens"
                                />
                            )}
                            {listing.status === 'shipped' && listing.shippedAt && (
                                <DeadlineCountdown
                                    deadline={listing.shippedAt + AUTO_RELEASE_DEADLINE_MS}
                                    label="Auto-release to seller if not confirmed"
                                />
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-1.5 text-sm">
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

                    <div className="flex flex-wrap gap-2">
                        {actionButton('fund', `Buy — escrow ${listing.price} ${listing.paymentToken}`, 'Payment escrowed')}
                        {actionButton('cancel', 'Cancel listing', 'Listing cancelled', 'outline')}
                        {actionButton('markShipped', 'Mark as shipped', 'Marked shipped')}
                        {actionButton('confirmReceived', 'Confirm received', 'Escrow released to seller')}
                        {actionButton('claimRefund', 'Claim refund', 'Escrow refunded', 'destructive')}
                        {actionButton('openDispute', 'Open dispute', 'Dispute opened', 'destructive')}
                        {actionButton(
                            'claimShipmentTimeout',
                            'Claim auto-release',
                            'Escrow auto-released to seller',
                            'outline'
                        )}
                    </div>

                    {role === 'other' && listing.status !== 'listed' && (
                        <p className="text-xs text-muted-foreground">
                            Only the buyer or seller of this order can act on it — auto-release is
                            the exception, anyone can trigger it once the deadline passes.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
