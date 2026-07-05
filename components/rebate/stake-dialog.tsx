'use client'

import { Lock, LockOpen } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { RebateCampaign, RebateNft } from '@/types/rebate'

interface StakeDialogProps {
    nft: RebateNft | null
    campaign: RebateCampaign | null
    onClose: () => void
    onConfirm: (nft: RebateNft) => void
}

export function StakeDialog({ nft, campaign, onClose, onConfirm }: StakeDialogProps) {
    const open = nft !== null && campaign !== null
    const unstaking = nft?.state === 'staked'
    const symbol = campaign?.rewardToken.symbol ?? ''

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {unstaking ? (
                            <LockOpen className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <Lock className="h-5 w-5 text-emerald-500" />
                        )}
                        {unstaking ? 'Unstake' : 'Stake'} {nft?.name}
                    </DialogTitle>
                    <DialogDescription>
                        {unstaking
                            ? 'Withdraw your NFT from the contract. Rebates stop accruing from the next epoch snapshot.'
                            : `Lock your NFT to earn fee rebates in ${symbol} every epoch. You can unstake and get it back anytime. Campaign by ${campaign?.partner.official ? 'Junoswap' : campaign?.partner.name}.`}
                    </DialogDescription>
                </DialogHeader>

                <dl className="space-y-1.5 text-sm">
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
                        <dt className="text-muted-foreground">Snapshot</dt>
                        <dd className="font-medium">Staked balance at each epoch block</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-muted-foreground">NFT custody</dt>
                        <dd className="font-medium">Held by contract, withdrawable</dd>
                    </div>
                </dl>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            if (nft) onConfirm(nft)
                            onClose()
                        }}
                    >
                        {unstaking ? (
                            <>
                                <LockOpen className="mr-1.5 h-4 w-4" /> Unstake
                            </>
                        ) : (
                            <>
                                <Lock className="mr-1.5 h-4 w-4" /> Stake
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
