'use client'

import Link from 'next/link'
import { formatUnits } from 'viem'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { campaignShareHash } from '@/lib/onchain/airdrop-share'
import type { AirdropCampaign } from '@/types/airdrop'
import { ArrowUpRight, Users } from 'lucide-react'

const STATUS_VARIANT: Record<AirdropCampaign['status'], 'default' | 'secondary' | 'outline'> = {
    active: 'default',
    closed: 'secondary',
    reclaimed: 'outline',
}

export function AirdropCampaignCard({ campaign }: { campaign: AirdropCampaign }) {
    const decimals = campaign.token_decimals ?? 18
    const remainingDisplay = formatUnits(BigInt(campaign.remaining_amount), decimals)

    return (
        <Link href={`/app/airdrop/s/${campaignShareHash(campaign.id as `0x${string}`)}`} className="block">
            <Card className="group h-full transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{campaign.token_symbol ?? 'Token'} giveaway</p>
                            <p className="truncate text-lg font-semibold tracking-tight">{campaign.title ?? 'Untitled airdrop'}</p>
                        </div>
                        <Badge variant={STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-y py-4">
                        <div><p className="text-xs text-muted-foreground">Available</p><p className="mt-1 text-base font-semibold tabular-nums">{remainingDisplay} <span className="text-xs font-medium">{campaign.token_symbol}</span></p></div>
                        <div><p className="text-xs text-muted-foreground">Distribution</p><p className="mt-1 text-sm font-medium">{campaign.amount_mode === 'fixed' ? 'Fixed amount' : 'Random amount'}</p></div>
                    </div>
                    <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{campaign.max_claimants ? `${campaign.claimed_count}/${campaign.max_claimants} claimed` : `${campaign.claimed_count} claimed`}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">View details <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
