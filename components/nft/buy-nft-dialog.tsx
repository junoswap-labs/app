'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFulfillNftOrder } from '@/hooks/useFulfillNftOrder'
import { toastSuccess, toastError } from '@/lib/toast'
import type { NftListing } from '@/types/marketplace'

export function BuyNftDialog({ listing }: { listing: NftListing }) {
    const { address, isConnected } = useAccount()
    const fulfillOrder = useFulfillNftOrder()
    const [open, setOpen] = useState(false)

    const isSeller = address?.toLowerCase() === listing.seller.toLowerCase()

    async function handleBuy() {
        if (!isConnected || !address) {
            toastError('Please connect your wallet first')
            return
        }
        try {
            await fulfillOrder.mutateAsync(listing.orderHash)
            setOpen(false)
            toastSuccess(`Bought ${listing.name}!`)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Purchase failed')
        }
    }

    if (listing.status === 'sold') {
        return (
            <Button disabled className="w-full">
                Sold
            </Button>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full" disabled={isSeller}>
                    {isSeller ? 'This is your listing' : 'Buy now'}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm purchase</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Item</span>
                        <span className="font-medium">{listing.name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-semibold">
                            {listing.price} {listing.paymentToken}
                        </span>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        onClick={handleBuy}
                        isLoading={fulfillOrder.isPending}
                        loadingText="Confirming on-chain…"
                        className="w-full"
                    >
                        Pay {listing.price} {listing.paymentToken}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
