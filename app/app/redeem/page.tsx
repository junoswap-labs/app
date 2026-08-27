'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { Coins, ReceiptText, Settings } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { RedeemItemCard } from '@/components/redeem/redeem-item-card'
import { useRedeemItems } from '@/hooks/useRedeemItems'
import { useListerProfiles } from '@/hooks/useListerProfile'
import { useJunoPtsBalance } from '@/hooks/useJunoPtsBalance'
import { useIsAdmin, useIsPartnerRedeem } from '@/hooks/useOnChainRoles'
import { JUNO_PTS_DECIMALS } from '@/types/redeem'
import type { RedeemItem, RedeemKind, RedeemTier } from '@/types/redeem'

type KindFilter = RedeemKind | 'all'

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'nft', label: 'NFT' },
    { value: 'merch', label: 'Merch' },
]

type ViewTab = 'all' | 'official' | 'registered'

export default function RedeemPage() {
    const [tab, setTab] = useState<ViewTab>('all')
    const [kindFilter, setKindFilter] = useState<KindFilter>('all')
    const { data: items, isLoading } = useRedeemItems()
    const listerWallets = useMemo(() => (items ?? []).map((i) => i.lister_wallet), [items])
    const { data: listerProfiles } = useListerProfiles(listerWallets)
    const { data: pointBalance } = useJunoPtsBalance()
    const isAdmin = useIsAdmin()
    const isPartnerRedeem = useIsPartnerRedeem()
    const canManage = isAdmin || isPartnerRedeem

    const itemsFor = (tier: RedeemTier | 'all') =>
        (items ?? []).filter((i) => (tier === 'all' || i.tier === tier) && (kindFilter === 'all' || i.kind === kindFilter))

    const renderGrid = (tier: RedeemTier | 'all') => {
        const tierItems = itemsFor(tier)
        if (isLoading) return null
        if (tierItems.length === 0) {
            return <EmptyState title="Nothing here yet" description="Items matching this filter will appear here." />
        }
        return (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {tierItems.map((item: RedeemItem) => (
                    <RedeemItemCard key={item.id} item={item} listerProfile={listerProfiles?.[item.lister_wallet]} />
                ))}
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Redeem</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Spend Points + tokens for NFTs and merch. Official items use the official
                            token; Registered items come from approved partners.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 self-start rounded-full border bg-muted/40 px-3 py-1.5 sm:self-auto">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold tabular-nums">
                            {pointBalance != null ? Number(formatUnits(pointBalance, JUNO_PTS_DECIMALS)).toLocaleString() : '—'} PTS
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canManage && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/app/redeem/manage">
                                <Settings className="mr-1.5 h-4 w-4" />
                                Partner Panel
                            </Link>
                        </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/app/redeem/orders">
                            <ReceiptText className="mr-1.5 h-4 w-4" />
                            My Redemptions
                        </Link>
                    </Button>
                </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as ViewTab)}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="official">Official</TabsTrigger>
                        <TabsTrigger value="registered">Registered</TabsTrigger>
                    </TabsList>
                    <div className="flex gap-1">
                        {KIND_FILTERS.map((f) => (
                            <Button
                                key={f.value}
                                variant={kindFilter === f.value ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setKindFilter(f.value)}
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <TabsContent value="all" className="mt-6">
                    {renderGrid('all')}
                </TabsContent>
                <TabsContent value="official" className="mt-6">
                    {renderGrid('official')}
                </TabsContent>
                <TabsContent value="registered" className="mt-6">
                    {renderGrid('registered')}
                </TabsContent>
            </Tabs>
        </div>
    )
}
