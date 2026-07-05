'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAnalytics } from '@/hooks/useAnalytics'

function shortAddr(addr: string) {
    return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

// Values are in token base units (not divided by decimals) — thousands grouping for readability for now
// TODO: format per-token decimals once token metadata is available
function fmt(value: string | number) {
    const s = typeof value === 'number' ? String(value) : value
    const [intPart = '0', frac] = s.split('.')
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return frac ? `${grouped}.${frac}` : grouped
}

function StatCard({ label, value }: { label: string; value: number | string }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{fmt(value)}</div>
            </CardContent>
        </Card>
    )
}

export function AnalyticsDashboard() {
    const [token, setToken] = useState<string | null>(null)
    const { data, isLoading, isError } = useAnalytics(token)

    if (isLoading) {
        return <p className="py-20 text-center text-sm text-muted-foreground">Loading analytics…</p>
    }
    if (isError || !data) {
        return (
            <EmptyState
                title="Couldn't load analytics"
                description="The analytics endpoint isn't reachable yet, or you don't have access."
            />
        )
    }

    const { overview, byToken, dailySales, topSellers, topCollections } = data

    return (
        <div className="space-y-8">
            {/* Overall */}
            <section>
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">Overall</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard label="Total items sold" value={overview.total_items_sold} />
                    <StatCard label="NFTs sold" value={overview.nft_items_sold} />
                    <StatCard label="RWAs sold" value={overview.rwa_items_sold} />
                    <StatCard label="Active listings" value={overview.active_nft_listings + overview.active_rwa_listings} />
                    <StatCard label="Open disputes" value={overview.open_disputes} />
                </div>
            </section>

            {/* Token selector */}
            <section>
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">Select token</h2>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={token === null ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setToken(null)}
                    >
                        All
                    </Button>
                    {byToken.map((row) => (
                        <Button
                            key={row.token}
                            variant={token === row.token ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setToken(row.token)}
                        >
                            {shortAddr(row.token)}
                        </Button>
                    ))}
                </div>
            </section>

            {/* Sales by token */}
            <SectionTable title="Sales by token">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Token</TableHead>
                            <TableHead className="text-right">NFT items</TableHead>
                            <TableHead className="text-right">RWA items</TableHead>
                            <TableHead className="text-right">Total items</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="text-right">Fee</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {byToken.map((r) => (
                            <TableRow key={r.token}>
                                <TableCell className="font-mono text-xs">{shortAddr(r.token)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.nft_items)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.rwa_items)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.total_items)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.total_volume)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.total_fee)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </SectionTable>

            {/* Daily sales */}
            <SectionTable title="Daily sales">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="text-right">Fee</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dailySales.map((r, i) => (
                            <TableRow key={`${r.day}-${r.source}-${r.token}-${i}`}>
                                <TableCell>{r.day}</TableCell>
                                <TableCell className="uppercase">{r.source}</TableCell>
                                <TableCell className="font-mono text-xs">{shortAddr(r.token)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.items)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.volume)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.fee)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </SectionTable>

            {/* Top sellers */}
            <SectionTable title="Top sellers">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Wallet</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="text-right">Fee</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topSellers.map((r, i) => (
                            <TableRow key={`${r.wallet}-${r.token}-${i}`}>
                                <TableCell className="font-mono text-xs">{shortAddr(r.wallet)}</TableCell>
                                <TableCell className="font-mono text-xs">{shortAddr(r.token)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.items)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.volume)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.fee)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </SectionTable>

            {/* Top NFT collections */}
            <SectionTable title="Top NFT collections">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Collection</TableHead>
                            <TableHead>Token</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Volume</TableHead>
                            <TableHead className="text-right">Fee</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topCollections.map((r, i) => (
                            <TableRow key={`${r.nft_contract}-${r.token}-${i}`}>
                                <TableCell className="font-mono text-xs">{shortAddr(r.nft_contract)}</TableCell>
                                <TableCell className="font-mono text-xs">{shortAddr(r.token)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.items)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.volume)}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmt(r.fee)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </SectionTable>
        </div>
    )
}

function SectionTable({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="p-4 pb-0">
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">{children}</CardContent>
        </Card>
    )
}
