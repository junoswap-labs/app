'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { ChevronDown, Coins, Plus, ReceiptText, Settings } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { RedeemItemCard } from '@/components/redeem/redeem-item-card'
import { RedemptionQueue } from '@/components/admin/redemption-queue'
import { MyRedeemListings } from '@/components/redeem/my-listings'
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

type ViewTab = 'all' | 'official' | 'registered' | 'manage'

export default function RedeemPage() {
    const [tab, setTab] = useState<ViewTab>('all')
    const [kindFilter, setKindFilter] = useState<KindFilter>('all')
    const [manageTab, setManageTab] = useState<'orders' | 'listings'>('orders')
    const { data: items, isLoading } = useRedeemItems()
    const listerWallets = useMemo(() => (items ?? []).map((i) => i.lister_wallet), [items])
    const { data: listerProfiles } = useListerProfiles(listerWallets)
    const { data: pointBalance } = useJunoPtsBalance()
    const isAdmin = useIsAdmin()
    const isPartnerRedeem = useIsPartnerRedeem()

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
                    {(isAdmin || isPartnerRedeem) && (
                        <div className="flex items-stretch overflow-hidden rounded-md border border-input shadow-sm">
                            <Button variant="ghost" size="sm" asChild className="rounded-none">
                                <Link href="/app/redeem/list">
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    List item
                                </Link>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" aria-label="More listing actions" className="rounded-none border-l px-2">
                                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => setTab('manage')}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Manage
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
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
                    {tab !== 'manage' && (
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
                    )}
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
                <TabsContent value="manage" className="mt-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {manageTab === 'orders'
                            ? 'Merch orders against your listings — attach a tracking number to mark an order shipped.'
                            : 'Your Redeem listings — edit details, pricing, or unpublish.'}
                    </p>
                    <div className="flex gap-1">
                        <Button type="button" size="sm" variant={manageTab === 'orders' ? 'secondary' : 'outline'} onClick={() => setManageTab('orders')}>
                            Redemptions
                        </Button>
                        <Button type="button" size="sm" variant={manageTab === 'listings' ? 'secondary' : 'outline'} onClick={() => setManageTab('listings')}>
                            My Listings
                        </Button>
                    </div>
                    {manageTab === 'orders' ? <RedemptionQueue /> : <MyRedeemListings />}
                </TabsContent>
            </Tabs>
        </div>
    )
}
