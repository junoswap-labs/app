'use client'

import Link from 'next/link'
import { formatUnits } from 'viem'
import { Card, CardContent } from '@/components/ui/card'
import { campaignShareHash } from '@/lib/onchain/airdrop-share'
import type { AirdropCampaign } from '@/types/airdrop'
import { ArrowUpRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

// Status is the only thing on these screens that earns a colour of its own — everything else stays
// neutral so the single primary-coloured CTA keeps its meaning.
const STATUS_DOT: Record<AirdropCampaign['status'], string> = {
    active: 'bg-positive',
    closed: 'bg-muted-foreground',
    reclaimed: 'bg-muted-foreground/50',
}

export function AirdropStatusPill({ status, className }: { status: AirdropCampaign['status']; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground',
                className
            )}
        >
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
            {status}
        </span>
    )
}

export function AirdropCampaignCard({ campaign }: { campaign: AirdropCampaign }) {
    const decimals = campaign.token_decimals ?? 18
    const remainingDisplay = formatUnits(BigInt(campaign.remaining_amount), decimals)

    return (
        <Link
            href={`/app/airdrop/s/${campaignShareHash(campaign.id as `0x${string}`)}`}
            className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            <Card className="h-full transition-colors hover:border-foreground/25">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-base font-semibold tracking-tight">{campaign.title ?? 'Untitled airdrop'}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                {campaign.token_symbol ?? 'Token'} · {campaign.amount_mode === 'fixed' ? 'Fixed amount' : 'Random amount'}
                            </p>
                        </div>
                        <AirdropStatusPill status={campaign.status} />
                    </div>

                    <div className="border-y py-3">
                        <p className="text-xs text-muted-foreground">Available</p>
                        <p className="mt-1 truncate text-lg font-semibold tabular-nums">
                            {remainingDisplay} <span className="text-xs font-medium text-muted-foreground">{campaign.token_symbol}</span>
                        </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                                {campaign.max_claimants ? `${campaign.claimed_count}/${campaign.max_claimants} claimed` : `${campaign.claimed_count} claimed`}
                            </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground">
                            View <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
