'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { AirdropCampaignCard } from '@/components/airdrop/campaign-card'
import { useAirdropCampaigns } from '@/hooks/useAirdropCampaigns'

export default function BrowseAirdropsPage() {
    const { data: campaigns, isLoading } = useAirdropCampaigns()
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState<'all' | 'active' | 'closed'>('all')
    const visibleCampaigns = useMemo(() => (campaigns ?? []).filter((campaign) => {
        const matchesQuery = (campaign.title ?? '').toLowerCase().includes(query.toLowerCase()) || (campaign.token_symbol ?? '').toLowerCase().includes(query.toLowerCase())
        return matchesQuery && (status === 'all' || campaign.status === status)
    }), [campaigns, query, status])

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
            <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div className="max-w-xl">
                    <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Sparkles className="h-4 w-4" /> Token distribution hub</div>
                    <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Airdrops, made simple.</h1>
                    <p className="mt-4 text-base leading-7 text-muted-foreground">Discover active token giveaways, connect your wallet, and claim in a few seconds.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/app/airdrop/manage">My airdrops</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/app/airdrop/create">Create airdrop</Link>
                    </Button>
                </div>
            </div>

            <div className="mb-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Public campaigns</p><p className="mt-2 text-2xl font-semibold">{campaigns?.length ?? 0}</p></div>
                <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Active now</p><p className="mt-2 text-2xl font-semibold">{campaigns?.filter((c) => c.status === 'active').length ?? 0}</p></div>
                <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">How it works</p><p className="mt-2 text-sm font-medium">Connect · Claim · Receive</p></div>
            </div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by campaign or token" className="h-11 pl-9" /></div>
                <div className="flex items-center gap-1 rounded-xl border bg-card p-1"><SlidersHorizontal className="ml-2 h-4 w-4 text-muted-foreground" />{(['all', 'active', 'closed'] as const).map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${status === item ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>{item}</button>)}</div>
            </div>
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
    )
}
