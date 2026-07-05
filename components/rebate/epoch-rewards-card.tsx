'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { EpochReward, RebateCampaign } from '@/types/rebate'

const STATUS_LABEL: Record<EpochReward['status'], string> = {
    accruing: 'Accruing',
    claimable: 'Claimable',
    claimed: 'Claimed',
}

function formatRange(startsAt: string, endsAt: string) {
    const fmt = (iso: string) =>
        new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return `${fmt(startsAt)} – ${fmt(endsAt)}`
}

/** Sum claimable amounts per reward token (campaign pools are separate — never merge) */
export function claimableByToken(rewards: EpochReward[]): Record<string, number> {
    return rewards
        .filter((r) => r.status === 'claimable')
        .reduce<Record<string, number>>((acc, r) => {
            acc[r.rewardTokenSymbol] = (acc[r.rewardTokenSymbol] ?? 0) + r.rebateAmount
            return acc
        }, {})
}

export function EpochRewardsCard({
    rewards,
    campaigns,
    onClaim,
}: {
    rewards: EpochReward[]
    campaigns: RebateCampaign[]
    onClaim: (campaignId: string, epoch: number) => void
}) {
    const campaignName = (id: string) => {
        const c = campaigns.find((c) => c.id === id)
        return c ? (c.partner.official ? 'Junoswap' : c.partner.name) : id
    }
    const claimables = claimableByToken(rewards)
    const claimableLine = Object.entries(claimables)
        .map(([sym, amt]) => `${amt.toLocaleString()} ${sym}`)
        .join(' · ')

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Epoch rewards</CardTitle>
                <span className="text-sm text-muted-foreground">
                    Claimable:{' '}
                    <span className="font-semibold tabular-nums text-foreground">
                        {claimableLine || '0'}
                    </span>
                </span>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Epoch</TableHead>
                            <TableHead className="hidden sm:table-cell">Period</TableHead>
                            <TableHead className="text-right">Fees paid</TableHead>
                            <TableHead className="text-right">Rebate</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rewards.map((r) => (
                            <TableRow key={`${r.campaignId}-${r.epoch}`}>
                                <TableCell className="text-xs">
                                    {campaignName(r.campaignId)}
                                </TableCell>
                                <TableCell className="font-medium">#{r.epoch}</TableCell>
                                <TableCell className="hidden text-muted-foreground sm:table-cell">
                                    {formatRange(r.startsAt, r.endsAt)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.feesPaidKub.toFixed(1)} KUB
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {r.rebateAmount.toLocaleString()} {r.rewardTokenSymbol}
                                </TableCell>
                                <TableCell className="text-right">
                                    {r.status === 'claimable' ? (
                                        <Button
                                            size="sm"
                                            onClick={() => onClaim(r.campaignId, r.epoch)}
                                        >
                                            Claim
                                        </Button>
                                    ) : (
                                        <Badge variant="secondary">{STATUS_LABEL[r.status]}</Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
