'use client'

import { Flame, Lock, HandCoins, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface RebateHeroProps {
    /** Earned totals per reward token — campaigns pay in different tokens, never merged */
    totalEarned: Record<string, number>
    claimable: Record<string, number>
    burnedCount: number
    stakedCount: number
    onClaimAll: () => void
}

function tokenLine(amounts: Record<string, number>) {
    const entries = Object.entries(amounts)
    if (entries.length === 0) return '0'
    return entries.map(([sym, amt]) => `${amt.toLocaleString()} ${sym}`).join(' · ')
}

export function RebateHero({
    totalEarned,
    claimable,
    burnedCount,
    stakedCount,
    onClaimAll,
}: RebateHeroProps) {
    const hasClaimable = Object.keys(claimable).length > 0
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
                <CardContent className="relative p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" /> Total rebate earned
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                        {tokenLine(totalEarned)}
                    </div>
                </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-transparent to-transparent" />
                <CardContent className="relative flex items-end justify-between p-4">
                    <div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <HandCoins className="h-3.5 w-3.5" /> Claimable now
                        </div>
                        <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                            {tokenLine(claimable)}
                        </div>
                    </div>
                    <Button size="sm" disabled={!hasClaimable} onClick={onClaimAll}>
                        Claim all
                    </Button>
                </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-transparent to-transparent" />
                <CardContent className="relative p-4">
                    <div className="text-xs text-muted-foreground">Active boosts</div>
                    <div className="mt-1 flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                            <Flame className="h-5 w-5 text-orange-500" /> {burnedCount}
                            <span className="text-xs font-normal text-muted-foreground">burned</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                            <Lock className="h-5 w-5 text-emerald-500" /> {stakedCount}
                            <span className="text-xs font-normal text-muted-foreground">staked</span>
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
