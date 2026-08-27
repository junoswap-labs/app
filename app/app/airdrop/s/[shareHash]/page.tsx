'use client'

import { use } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { AirdropClaimPageContent } from '@/components/airdrop/claim-page-content'
import { useAirdropCampaignByShareHash } from '@/hooks/useAirdropCampaigns'

/** The public entry point for a shared QR code/link — resolves the hashed token to a real
 *  campaignId (see lib/onchain/airdrop-share.ts) before rendering the same claim UI as
 *  app/app/airdrop/[campaignId]/page.tsx. Works regardless of visibility: unlisted just means "not
 *  on the Browse page", not "the link doesn't work". */
export default function AirdropSharePage({ params }: { params: Promise<{ shareHash: string }> }) {
    const { shareHash } = use(params)
    const { data: campaign, isLoading } = useAirdropCampaignByShareHash(shareHash)

    if (isLoading) {
        return (
            <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        )
    }
    if (!campaign) {
        return (
            <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
                <EmptyState title="Airdrop not found" description="This link may be invalid, or the campaign hasn't been indexed yet — try again in a moment." />
            </div>
        )
    }

    return <AirdropClaimPageContent campaignId={campaign.id} />
}
