'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { RedeemItem, ShippingInfo } from '@/types/redeem'

interface RedeemDialogProps {
    item: RedeemItem | null
    pointBalance: number
    tokenBalances: Record<string, number>
    onClose: () => void
    onConfirm: (item: RedeemItem, shipping?: ShippingInfo) => void
}

const EMPTY_SHIPPING: ShippingInfo = { fullName: '', phone: '', address: '' }

export function RedeemDialog({
    item,
    pointBalance,
    tokenBalances,
    onClose,
    onConfirm,
}: RedeemDialogProps) {
    const [shipping, setShipping] = useState<ShippingInfo>(EMPTY_SHIPPING)

    const tokenBalance = item ? (tokenBalances[item.tokenSymbol] ?? 0) : 0
    const insufficientPoints = item !== null && pointBalance < item.pricePoints
    const insufficientToken = item !== null && tokenBalance < item.priceToken
    const needsShipping = item?.kind === 'merch'
    const shippingIncomplete =
        needsShipping && (!shipping.fullName.trim() || !shipping.phone.trim() || !shipping.address.trim())

    const close = () => {
        setShipping(EMPTY_SHIPPING)
        onClose()
    }

    return (
        <Dialog open={item !== null} onOpenChange={(o) => !o && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Redeem {item?.name}</DialogTitle>
                    <DialogDescription>
                        {item?.kind === 'nft'
                            ? 'The NFT is transferred to your wallet on-chain after payment.'
                            : 'Merch orders follow the escrow flow: Funded → Shipped → Completed.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                    <dl className="space-y-1.5">
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Points</dt>
                            <dd className="tabular-nums">
                                <span className={insufficientPoints ? 'text-destructive' : 'font-medium'}>
                                    {item?.pricePoints.toLocaleString()} PTS
                                </span>{' '}
                                <span className="text-muted-foreground">
                                    (you have {pointBalance.toLocaleString()})
                                </span>
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Token</dt>
                            <dd className="tabular-nums">
                                <span className={insufficientToken ? 'text-destructive' : 'font-medium'}>
                                    {item?.priceToken.toLocaleString()} {item?.tokenSymbol}
                                </span>{' '}
                                <span className="text-muted-foreground">
                                    (you have {tokenBalance.toLocaleString()})
                                </span>
                            </dd>
                        </div>
                    </dl>

                    {needsShipping && (
                        <>
                            <Separator />
                            <div className="space-y-2.5">
                                <div className="space-y-1.5">
                                    <Label htmlFor="ship-name">Full name</Label>
                                    <Input
                                        id="ship-name"
                                        value={shipping.fullName}
                                        onChange={(e) =>
                                            setShipping({ ...shipping, fullName: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ship-phone">Phone</Label>
                                    <Input
                                        id="ship-phone"
                                        value={shipping.phone}
                                        onChange={(e) =>
                                            setShipping({ ...shipping, phone: e.target.value })
                                        }
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ship-address">Shipping address</Label>
                                    <Textarea
                                        id="ship-address"
                                        rows={3}
                                        value={shipping.address}
                                        onChange={(e) =>
                                            setShipping({ ...shipping, address: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        disabled={insufficientPoints || insufficientToken || Boolean(shippingIncomplete)}
                        onClick={() => {
                            if (item) onConfirm(item, needsShipping ? shipping : undefined)
                            close()
                        }}
                    >
                        Confirm redeem
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
