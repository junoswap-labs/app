import type { Metadata } from 'next'
import { CreatorFeeClaimPanel } from '@/components/launchpad/creator-fee-claim-panel'

export const metadata: Metadata = {
    title: 'Creator Rewards — Junoswap Launchpad',
    description: 'Claim your share of the trading fees your launched tokens generated.',
}

export default function CreatorFeePage() {
    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold">Creator Rewards</h1>
                <p className="text-sm text-muted-foreground">
                    Every trade on your launched tokens&apos; bonding curve earns a 1% fee. Each
                    epoch, 90% of that fee is paid back to you in KKUB. Unclaimed rewards are
                    forfeited after 3 epochs, so claim before the window closes.
                </p>
            </header>
            <CreatorFeeClaimPanel />
        </div>
    )
}
