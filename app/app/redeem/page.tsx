'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Coins, ReceiptText } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { RedeemItemCard } from '@/components/redeem/redeem-item-card'
import { RedeemDialog } from '@/components/redeem/redeem-dialog'
import { toastSuccess } from '@/lib/toast'
import { MOCK_POINT_BALANCE, MOCK_TOKEN_BALANCES, MOCK_REDEEM_ITEMS } from '@/lib/mock/redeem'
import { useMockRedemptions } from '@/store/mock-redemptions'
import type { RedeemItem, RedeemKind, RedeemTier, ShippingInfo } from '@/types/redeem'

type KindFilter = RedeemKind | 'all'

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'nft', label: 'NFT' },
    { value: 'merch', label: 'Merch' },
]

export default function RedeemPage() {
    // Mock-data phase: balances/stock live in local state instead of chain + Supabase.
    const [pointBalance, setPointBalance] = useState(MOCK_POINT_BALANCE)
    const [tokenBalances, setTokenBalances] = useState(MOCK_TOKEN_BALANCES)
    const [items, setItems] = useState(MOCK_REDEEM_ITEMS)
    const [kindFilter, setKindFilter] = useState<KindFilter>('all')
    const [redeemTarget, setRedeemTarget] = useState<RedeemItem | null>(null)
    const addOrder = useMockRedemptions((s) => s.addOrder)

    const itemsFor = (tier: RedeemTier) =>
        items.filter(
            (i) => i.tier === tier && (kindFilter === 'all' || i.kind === kindFilter)
        )

    const balancesLine = useMemo(
        () =>
            Object.entries(tokenBalances)
                .map(([sym, bal]) => `${bal.toLocaleString()} ${sym}`)
                .join(' · '),
        [tokenBalances]
    )

    const handleConfirm = (item: RedeemItem, shipping?: ShippingInfo) => {
        setPointBalance((p) => p - item.pricePoints)
        setTokenBalances((prev) => ({
            ...prev,
            [item.tokenSymbol]: (prev[item.tokenSymbol] ?? 0) - item.priceToken,
        }))
        setItems((prev) =>
            prev.map((i) =>
                i.id === item.id && i.stock !== null ? { ...i, stock: i.stock - 1 } : i
            )
        )
        const now = Date.now()
        addOrder({
            id: `rd-${now}`,
            itemId: item.id,
            itemName: item.name,
            kind: item.kind,
            tier: item.tier,
            pricePoints: item.pricePoints,
            priceToken: item.priceToken,
            tokenSymbol: item.tokenSymbol,
            // NFT settles on-chain instantly; merch waits for admin verification
            status: item.kind === 'nft' ? 'completed' : 'submitted',
            shipping,
            createdAt: now,
            updatedAt: now,
        })
        toastSuccess(
            item.kind === 'nft'
                ? `${item.name} redeemed — NFT will arrive in your wallet (mock)`
                : `${item.name} redeemed — track it in My Redemptions (mock)`
        )
    }

    const renderGrid = (tier: RedeemTier) => {
        const tierItems = itemsFor(tier)
        if (tierItems.length === 0) {
            return (
                <EmptyState
                    title="Nothing here yet"
                    description="Items matching this filter will appear here."
                />
            )
        }
        return (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {tierItems.map((item) => (
                    <RedeemItemCard key={item.id} item={item} onRedeem={setRedeemTarget} />
                ))}
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Redeem</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Spend Points + tokens for NFTs and merch. Official items use the official
                        token; community items use registered tokens.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/app/redeem/orders">
                            <ReceiptText className="mr-1.5 h-4 w-4" />
                            My Redemptions
                        </Link>
                    </Button>
                    <Card>
                        <CardContent className="flex items-center gap-2.5 px-4 py-2.5">
                            <Coins className="h-4 w-4 text-primary" />
                            <div className="text-sm">
                                <span className="font-semibold tabular-nums">
                                    {pointBalance.toLocaleString()} PTS
                                </span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                    {balancesLine}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Tabs defaultValue="official">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <TabsList>
                        <TabsTrigger value="official">Official</TabsTrigger>
                        <TabsTrigger value="registered">Registered tokens</TabsTrigger>
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

                <TabsContent value="official" className="mt-6">
                    {renderGrid('official')}
                </TabsContent>
                <TabsContent value="registered" className="mt-6">
                    {renderGrid('registered')}
                </TabsContent>
            </Tabs>

            <RedeemDialog
                item={redeemTarget}
                pointBalance={pointBalance}
                tokenBalances={tokenBalances}
                onClose={() => setRedeemTarget(null)}
                onConfirm={handleConfirm}
            />
        </div>
    )
}
