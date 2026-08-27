'use client'

import { formatUnits } from 'viem'
import { useAirdropClaims } from '@/hooks/useAirdropCampaigns'

function shortenAddress(address: string): string {
    return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Recent claims for one campaign — the "who's winning" feed that makes a public giveaway fun to
 *  watch, powered by airdrop_claims' public-read RLS policy. */
export function LiveClaimFeed({ campaignId, decimals, symbol }: { campaignId: string; decimals: number; symbol: string }) {
    const { data: claims } = useAirdropClaims(campaignId)

    if (!claims || claims.length === 0) {
        return <p className="text-sm text-muted-foreground">No claims yet — be the first!</p>
    }

    return (
        <ul className="space-y-1.5">
            {claims.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-muted-foreground">{shortenAddress(c.recipient_wallet)}</span>
                    <span className="font-medium tabular-nums">
                        {formatUnits(BigInt(c.amount), decimals)} {symbol}
                    </span>
                </li>
            ))}
        </ul>
    )
}
