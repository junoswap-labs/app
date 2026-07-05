'use client'

import { useState } from 'react'
import { Flame, TriangleAlert } from 'lucide-react'
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
import type { RebateCampaign, RebateNft } from '@/types/rebate'

interface BurnDialogProps {
    nft: RebateNft | null
    campaign: RebateCampaign | null
    onClose: () => void
    onConfirm: (nft: RebateNft) => void
}

// Burn is permanent (NFT goes to 0xdead), so this dialog requires typing BURN to confirm
export function BurnDialog({ nft, campaign, onClose, onConfirm }: BurnDialogProps) {
    const [confirmText, setConfirmText] = useState('')
    const open = nft !== null && campaign !== null
    const symbol = campaign?.rewardToken.symbol ?? ''

    const close = () => {
        setConfirmText('')
        onClose()
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" />
                        Burn {nft?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Burn this NFT permanently in exchange for a high fee-rebate rate with a
                        lifetime cap. Campaign by{' '}
                        {campaign?.partner.official ? 'Junoswap' : campaign?.partner.name}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-orange-700 dark:text-orange-300">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>
                            This is irreversible. The NFT is sent to the burn address (0xdead) and
                            can never be recovered.
                        </p>
                    </div>

                    <dl className="space-y-1.5">
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Rebate rate</dt>
                            <dd className="font-medium tabular-nums">
                                {((campaign?.rateBps ?? 0) / 100).toFixed(0)}% of fees
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Paid in</dt>
                            <dd className="font-medium">{symbol}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Lifetime cap</dt>
                            <dd className="font-medium tabular-nums">
                                {campaign?.lifetimeCap} {symbol}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Rewards stop when</dt>
                            <dd className="font-medium">Cap or campaign pool is exhausted</dd>
                        </div>
                    </dl>

                    <div className="space-y-1.5">
                        <Label htmlFor="burn-confirm">
                            Type <span className="font-mono font-semibold">BURN</span> to confirm
                        </Label>
                        <Input
                            id="burn-confirm"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="BURN"
                            autoComplete="off"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={confirmText !== 'BURN'}
                        onClick={() => {
                            if (nft) onConfirm(nft)
                            close()
                        }}
                    >
                        <Flame className="mr-1.5 h-4 w-4" />
                        Burn forever
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
