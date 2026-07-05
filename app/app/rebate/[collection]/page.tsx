'use client'

// Route param folder is named [collection] for historical reasons; the value is a campaign id.
import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgramBadge } from '@/components/rebate/program-badge'
import { CampaignPanel } from '@/components/rebate/campaign-panel'
import { BurnDialog } from '@/components/rebate/burn-dialog'
import { StakeDialog } from '@/components/rebate/stake-dialog'
import { useMockRebate } from '@/store/mock-rebate'
import { MOCK_REBATE_CAMPAIGNS } from '@/lib/mock/rebate'
import { toastSuccess } from '@/lib/toast'
import type { RebateNft } from '@/types/rebate'

export default function RebateCampaignPage({
    params,
}: {
    params: Promise<{ collection: string }>
}) {
    const { collection: campaignId } = use(params)
    const campaign = MOCK_REBATE_CAMPAIGNS.find((c) => c.id === campaignId)
    const nfts = useMockRebate((s) => s.nfts).filter(
        (n) => n.collection.toLowerCase() === campaign?.collection.toLowerCase()
    )
    const updateNft = useMockRebate((s) => s.updateNft)
    const [burnTarget, setBurnTarget] = useState<RebateNft | null>(null)
    const [stakeTarget, setStakeTarget] = useState<RebateNft | null>(null)

    if (!campaign) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Campaign not found"
                    description="This rebate campaign doesn't exist or has ended."
                    action={
                        <Button asChild variant="outline">
                            <Link href="/app/rebate">Back to Rebate</Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    const isBurn = campaign.program === 'burn'
    const symbol = campaign.rewardToken.symbol

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <div className="space-y-3">
                <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                    <Link href="/app/rebate">
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Rebate
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {campaign.collectionName}
                    </h1>
                    <ProgramBadge program={campaign.program} />
                    <Badge variant="secondary">
                        {campaign.partner.official
                            ? 'Official campaign'
                            : `Co-campaign × ${campaign.partner.name}`}
                    </Badge>
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    {isBurn
                        ? `Burn program — ${(campaign.rateBps / 100).toFixed(0)}% of your Junoswap trading fees back in ${symbol}, up to a lifetime cap of ${campaign.lifetimeCap} ${symbol} per burned NFT. Burning is permanent.`
                        : `Stake program — ${(campaign.rateBps / 100).toFixed(0)}% of your Junoswap trading fees back in ${symbol} every ${campaign.epochLengthDays}-day epoch while staked. Unstake anytime.`}
                </p>
                <p className="text-xs text-muted-foreground">
                    Reward pool: {campaign.poolRemaining.toLocaleString()} {symbol} remaining
                    {campaign.endsAt &&
                        ` · campaign ends ${new Date(campaign.endsAt).toLocaleDateString('en-GB')}`}
                </p>
            </div>

            {nfts.length === 0 ? (
                <EmptyState
                    title="No NFTs from this collection"
                    description="NFTs you own from this collection will appear here."
                />
            ) : (
                <CampaignPanel
                    campaign={campaign}
                    nfts={nfts}
                    onBurn={setBurnTarget}
                    onStake={setStakeTarget}
                    onUnstake={setStakeTarget}
                />
            )}

            <BurnDialog
                nft={burnTarget}
                campaign={campaign}
                onClose={() => setBurnTarget(null)}
                onConfirm={(nft) => {
                    updateNft(nft, { state: 'burned', capUsed: 0 })
                    toastSuccess(`${nft.name} burned for rebate (mock)`)
                }}
            />
            <StakeDialog
                nft={stakeTarget}
                campaign={campaign}
                onClose={() => setStakeTarget(null)}
                onConfirm={(nft) => {
                    const staking = nft.state !== 'staked'
                    updateNft(nft, { state: staking ? 'staked' : 'idle' })
                    toastSuccess(`${nft.name} ${staking ? 'staked' : 'unstaked'} (mock)`)
                }}
            />
        </div>
    )
}
