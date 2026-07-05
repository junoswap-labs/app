'use client'

import { ImageOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProgramBadge } from '@/components/rebate/program-badge'
import type { RebateCampaign, RebateNft } from '@/types/rebate'

interface CampaignPanelProps {
    campaign: RebateCampaign
    nfts: RebateNft[]
    onBurn: (nft: RebateNft) => void
    onStake: (nft: RebateNft) => void
    onUnstake: (nft: RebateNft) => void
}

function nftActionArea(
    nft: RebateNft,
    campaign: RebateCampaign,
    handlers: Pick<CampaignPanelProps, 'onBurn' | 'onStake' | 'onUnstake'>
) {
    if (nft.state === 'burned') {
        const cap = campaign.lifetimeCap ?? 0
        const used = nft.capUsed ?? 0
        const pct = cap > 0 ? Math.min((used / cap) * 100, 100) : 0
        return (
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Lifetime cap</span>
                    <span className="tabular-nums">
                        {used} / {cap} {campaign.rewardToken.symbol}
                    </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        )
    }
    if (campaign.program === 'burn') {
        return (
            <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => handlers.onBurn(nft)}
            >
                Burn for rebate
            </Button>
        )
    }
    return nft.state === 'staked' ? (
        <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => handlers.onUnstake(nft)}
        >
            Unstake
        </Button>
    ) : (
        <Button size="sm" className="w-full" onClick={() => handlers.onStake(nft)}>
            Stake
        </Button>
    )
}

export function CampaignPanel({ campaign, nfts, onBurn, onStake, onUnstake }: CampaignPanelProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{campaign.collectionName}</CardTitle>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {(campaign.rateBps / 100).toFixed(0)}% in {campaign.rewardToken.symbol}
                    </span>
                    <ProgramBadge program={campaign.program} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {nfts.map((nft) => (
                        <div
                            key={nft.tokenId}
                            className="space-y-2 rounded-lg border border-border/60 p-2"
                        >
                            <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                                {nft.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={nft.imageUrl}
                                        alt={nft.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                        <ImageOff className="h-5 w-5" />
                                    </div>
                                )}
                                {nft.state !== 'idle' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                        <Badge variant="secondary">
                                            {nft.state === 'burned' ? 'BURNED' : 'STAKED'}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <p className="truncate text-xs font-medium">{nft.name}</p>
                            {nftActionArea(nft, campaign, { onBurn, onStake, onUnstake })}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
