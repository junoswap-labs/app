'use client'

import { formatEther } from 'viem'
import { useAccount } from 'wagmi'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCreatorFeeClaims } from '@/hooks/useCreatorFeeClaims'
import { useClaimCreatorFee } from '@/hooks/useClaimCreatorFee'
import type { ClaimStatus, CreatorFeeClaimRow } from '@/types/creator-fee'

function formatKkub(wei: string): string {
    const n = Number(formatEther(BigInt(wei)))
    return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} KKUB`
}

const STATUS_STYLE: Record<ClaimStatus, string> = {
    claimable: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
    claimed: 'bg-muted text-muted-foreground',
    expired: 'bg-red-500/15 text-red-500 border-red-500/20',
}

const STATUS_LABEL: Record<ClaimStatus, string> = {
    claimable: 'Claimable',
    claimed: 'Claimed',
    expired: 'Expired',
}

function daysLeft(deadline: number): string {
    const secs = deadline - Math.floor(Date.now() / 1000)
    if (secs <= 0) return 'Forfeited'
    const days = Math.floor(secs / 86_400)
    if (days >= 1) return `${days}d left to claim`
    return `${Math.floor(secs / 3600)}h left to claim`
}

function ClaimRow({
    row,
    onClaim,
    pending,
    disabled,
}: {
    row: CreatorFeeClaimRow
    onClaim: (row: CreatorFeeClaimRow) => void
    pending: boolean
    disabled: boolean
}) {
    return (
        <div className="flex items-center justify-between gap-3 border-t py-3 first:border-t-0">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium">Epoch {row.epochId}</span>
                    <Badge className={STATUS_STYLE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                    {row.status === 'claimable' ? daysLeft(row.claimDeadline) : formatKkub(row.amount)}
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{formatKkub(row.amount)}</span>
                <Button
                    size="sm"
                    variant={row.status === 'claimable' ? 'default' : 'secondary'}
                    disabled={row.status !== 'claimable' || disabled}
                    isLoading={pending}
                    loadingText="Claiming…"
                    onClick={() => onClaim(row)}
                >
                    {row.status === 'claimed' ? 'Claimed' : 'Claim'}
                </Button>
            </div>
        </div>
    )
}

export function CreatorFeeClaimPanel() {
    const { isConnected } = useAccount()
    const { rows, isLoading, totalClaimable } = useCreatorFeeClaims()
    const { claim, claimAll, pendingEpoch, isPending } = useClaimCreatorFee()

    if (!isConnected) {
        return (
            <Card className="p-6 text-center text-sm text-muted-foreground">
                Connect your wallet to view and claim your creator rewards.
            </Card>
        )
    }

    if (!isLoading && rows.length === 0) {
        return (
            <Card className="p-6 text-center text-sm text-muted-foreground">
                No creator rewards yet. Rewards accrue as your launched tokens are traded on the
                bonding curve.
            </Card>
        )
    }

    return (
        <Card className="p-5">
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <div className="text-sm text-muted-foreground">Claimable now</div>
                    <div className="text-2xl font-bold tabular-nums">
                        {formatKkub(totalClaimable.toString())}
                    </div>
                </div>
                <Button
                    disabled={totalClaimable === 0n || isPending}
                    isLoading={pendingEpoch === -1}
                    loadingText="Claiming…"
                    onClick={() => claimAll(rows)}
                >
                    Claim all
                </Button>
            </div>

            <div>
                {rows.map((row) => (
                    <ClaimRow
                        key={row.epochId}
                        row={row}
                        onClaim={claim}
                        pending={pendingEpoch === row.epochId}
                        disabled={isPending}
                    />
                ))}
            </div>
        </Card>
    )
}
