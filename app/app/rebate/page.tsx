'use client'

import { useMemo, useState } from 'react'
import { Wallet, Images, Flame, ArrowLeftRight, Undo2, HandCoins } from 'lucide-react'
import { RebateHero } from '@/components/rebate/rebate-hero'
import { ProgramCompare } from '@/components/rebate/program-compare'
import { CampaignCard } from '@/components/rebate/campaign-card'
import { EpochRewardsCard, claimableByToken } from '@/components/rebate/epoch-rewards-card'
import { toastSuccess } from '@/lib/toast'
import { useMockRebate } from '@/store/mock-rebate'
import { MOCK_REBATE_CAMPAIGNS, MOCK_EPOCH_REWARDS } from '@/lib/mock/rebate'
import type { EpochReward } from '@/types/rebate'

const FLOW_STEPS = [
    { icon: Wallet, label: 'Connect' },
    { icon: Images, label: 'View your NFTs' },
    { icon: Flame, label: 'Burn or Stake' },
    { icon: ArrowLeftRight, label: 'Trade on Junoswap' },
    { icon: Undo2, label: 'Fees come back' },
    { icon: HandCoins, label: 'Claim rewards' },
] as const

function earnedByToken(rewards: EpochReward[]): Record<string, number> {
    return rewards
        .filter((r) => r.status !== 'accruing')
        .reduce<Record<string, number>>((acc, r) => {
            acc[r.rewardTokenSymbol] = (acc[r.rewardTokenSymbol] ?? 0) + r.rebateAmount
            return acc
        }, {})
}

export default function RebatePage() {
    // Mock-data phase: shared store stands in for contract reads + sync poller.
    const nfts = useMockRebate((s) => s.nfts)
    const [rewards, setRewards] = useState(MOCK_EPOCH_REWARDS)

    const campaigns = useMemo(
        () =>
            MOCK_REBATE_CAMPAIGNS.map((campaign) => ({
                campaign,
                nfts: nfts.filter((n) => n.collection === campaign.collection),
            })),
        [nfts]
    )

    const burnedCount = nfts.filter((n) => n.state === 'burned').length
    const stakedCount = nfts.filter((n) => n.state === 'staked').length
    const claimable = claimableByToken(rewards)

    // Real flow: one claim(campaignId) tx per campaign — pools are separate contracts/accounts
    const claim = (targets: { campaignId: string; epoch: number }[]) => {
        setRewards((prev) =>
            prev.map((r) =>
                targets.some((t) => t.campaignId === r.campaignId && t.epoch === r.epoch)
                    ? { ...r, status: 'claimed' }
                    : r
            )
        )
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Trade. Get fees{' '}
                        <span className="bg-gradient-to-r from-primary to-[#FF914D] bg-clip-text text-transparent">
                            back
                        </span>
                        .
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Burn or stake your NFTs in rebate campaigns — official ones by Junoswap and
                        co-campaigns with partner projects, each paying rewards in its own token
                        from its own pool. Every campaign&apos;s program is set by its owner; the
                        app shows you the right flow automatically.
                    </p>
                </div>

                <RebateHero
                    totalEarned={earnedByToken(rewards)}
                    claimable={claimable}
                    burnedCount={burnedCount}
                    stakedCount={stakedCount}
                    onClaimAll={() => {
                        const targets = rewards
                            .filter((r) => r.status === 'claimable')
                            .map((r) => ({ campaignId: r.campaignId, epoch: r.epoch }))
                        claim(targets)
                        toastSuccess(
                            `Claimed ${Object.entries(claimable)
                                .map(([sym, amt]) => `${amt.toLocaleString()} ${sym}`)
                                .join(' + ')} (mock)`
                        )
                    }}
                />

                <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs text-muted-foreground">
                    {FLOW_STEPS.map((step, i) => (
                        <span key={step.label} className="flex items-center gap-1">
                            <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
                                <step.icon className="h-3.5 w-3.5" />
                                {step.label}
                            </span>
                            {i < FLOW_STEPS.length - 1 && <span aria-hidden>→</span>}
                        </span>
                    ))}
                </div>
            </div>

            <ProgramCompare />

            <div className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight">Campaigns</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {campaigns.map(({ campaign, nfts: campaignNfts }) => (
                        <CampaignCard key={campaign.id} campaign={campaign} nfts={campaignNfts} />
                    ))}
                </div>
            </div>

            <EpochRewardsCard
                rewards={rewards}
                campaigns={MOCK_REBATE_CAMPAIGNS}
                onClaim={(campaignId, epoch) => {
                    claim([{ campaignId, epoch }])
                    toastSuccess(`Claimed epoch #${epoch} (mock)`)
                }}
            />
        </div>
    )
}
