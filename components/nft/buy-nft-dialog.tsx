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
import { useMockListings } from '@/store/mock-listings'
import { toastSuccess, toastError } from '@/lib/toast'
import type { NftListing } from '@/types/marketplace'

export function BuyNftDialog({ listing }: { listing: NftListing }) {
    const { address, isConnected } = useAccount()
    const markSold = useMockListings((s) => s.markSold)
    const [open, setOpen] = useState(false)
    const [confirming, setConfirming] = useState(false)

    const isSeller = address?.toLowerCase() === listing.seller.toLowerCase()

    async function handleBuy() {
        if (!isConnected || !address) {
            toastError('Please connect your wallet first')
            return
        }
        setConfirming(true)
        // MOCK: simulate waiting for on-chain tx confirmation (real flow = writeContract → receipt → sync poller)
        await new Promise((r) => setTimeout(r, 1500))
        markSold(listing.contract, listing.tokenId, address)
        setConfirming(false)
        setOpen(false)
        toastSuccess(`Bought ${listing.name}!`)
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
                        isLoading={confirming}
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
