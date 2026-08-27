'use client'

import { use } from 'react'
import { AirdropClaimPageContent } from '@/components/airdrop/claim-page-content'

export default function AirdropClaimPage({ params }: { params: Promise<{ campaignId: string }> }) {
    const { campaignId } = use(params)
    return <AirdropClaimPageContent campaignId={campaignId} />
}
