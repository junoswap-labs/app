'use client'

import Link from 'next/link'
import { ChevronRight, Flame, Lock, ImageOff, Coins } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgramBadge } from '@/components/rebate/program-badge'
import type { RebateCampaign, RebateNft } from '@/types/rebate'

// Campaign summary card — click through to the full campaign page.
export function CampaignCard({
    campaign,
    nfts,
}: {
    campaign: RebateCampaign
    nfts: RebateNft[]
}) {
    const burned = nfts.filter((n) => n.state === 'burned').length
    const staked = nfts.filter((n) => n.state === 'staked').length
    const cover = nfts.find((n) => n.imageUrl)?.imageUrl

    return (
        <Link href={`/app/rebate/${campaign.id}`} className="group block">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative aspect-[2/1] bg-muted">
                    {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={cover}
                            alt={campaign.collectionName}
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageOff className="h-6 w-6" />
                        </div>
                    )}
                    <ProgramBadge program={campaign.program} className="absolute left-2 top-2" />
                    <Badge
                        variant="secondary"
                        className="absolute right-2 top-2 bg-background/80 backdrop-blur"
                    >
                        {campaign.partner.official ? 'Official' : `× ${campaign.partner.name}`}
                    </Badge>
                </div>

                <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{campaign.collectionName}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                            {(campaign.rateBps / 100).toFixed(0)}% rebate
                        </span>
                        <span className="flex items-center gap-1">
                            <Coins className="h-3.5 w-3.5" /> paid in {campaign.rewardToken.symbol}
                        </span>
                        <span>{nfts.length} owned</span>
                        {campaign.program === 'burn' ? (
                            <span className="flex items-center gap-1">
                                <Flame className="h-3.5 w-3.5 text-orange-500" /> {burned} burned
                            </span>
                        ) : (
                            <span className="flex items-center gap-1">
                                <Lock className="h-3.5 w-3.5 text-emerald-500" /> {staked} staked
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Pool: {campaign.poolRemaining.toLocaleString()} {campaign.rewardToken.symbol}{' '}
                        left
                        {campaign.endsAt &&
                            ` · ends ${new Date(campaign.endsAt).toLocaleDateString('en-GB')}`}
                    </p>
                </CardContent>
            </Card>
        </Link>
    )
}
