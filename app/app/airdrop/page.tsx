'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { AirdropCampaignCard } from '@/components/airdrop/campaign-card'
import { useAirdropCampaigns } from '@/hooks/useAirdropCampaigns'
import { cn } from '@/lib/utils'

export default function BrowseAirdropsPage() {
    const { data: campaigns, isLoading } = useAirdropCampaigns()
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState<'all' | 'active' | 'closed'>('active')

    const counts = useMemo(
        () => ({
            all: campaigns?.length ?? 0,
            active: campaigns?.filter((c) => c.status === 'active').length ?? 0,
            closed: campaigns?.filter((c) => c.status === 'closed').length ?? 0,
        }),
        [campaigns]
    )

    const visibleCampaigns = useMemo(() => (campaigns ?? []).filter((campaign) => {
        const matchesQuery = (campaign.title ?? '').toLowerCase().includes(query.toLowerCase()) || (campaign.token_symbol ?? '').toLowerCase().includes(query.toLowerCase())
        return matchesQuery && (status === 'all' || campaign.status === status)
    }), [campaigns, query, status])

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <header className="flex flex-col gap-6 border-b pb-8 md:flex-row md:items-end md:justify-between">
                <div className="max-w-xl">
                    <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Airdrops</h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                        Discover active token giveaways, connect your wallet, and claim in a few seconds.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
                    <Button variant="outline" asChild>
                        <Link href="/app/airdrop/manage">My airdrops</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/app/airdrop/create">Create airdrop</Link>
                    </Button>
                </div>
            </header>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by campaign or token" className="h-11 pl-9" />
                </div>
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
                    <div className="inline-flex h-11 items-center gap-1 rounded-xl border bg-card p-1">
                        {(['all', 'active', 'closed'] as const).map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setStatus(item)}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                                    status === item ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {item} <span className="tabular-nums text-muted-foreground">{counts[item]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-6">
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : !campaigns || campaigns.length === 0 ? (
                    <EmptyState
                        title="No public airdrops right now"
                        description="Check back later, or create your own shareable link or QR code to give away tokens."
                        action={
                            <Button asChild>
                                <Link href="/app/airdrop/create">Create an airdrop</Link>
                            </Button>
                        }
                    />
                ) : visibleCampaigns.length === 0 ? (
                    <EmptyState title="No campaigns match your search" description="Try another keyword or clear the status filter." />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleCampaigns.map((c) => (
                            <AirdropCampaignCard key={c.id} campaign={c} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
