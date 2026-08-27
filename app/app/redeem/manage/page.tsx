'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Package, PackageCheck, PackageX, Plus, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { RedemptionQueue } from '@/components/admin/redemption-queue'
import { MyRedeemListings } from '@/components/redeem/my-listings'
import { useAdminRedeemOrders } from '@/hooks/useRedeemOrders'
import { useMyRedeemItems } from '@/hooks/useRedeemItems'
import { useIsAdmin, useIsPartnerRedeem } from '@/hooks/useOnChainRoles'
import { useAccount } from 'wagmi'

/**
 * Partner back office — every transaction a Registered/Official lister needs to act on
 * (Redemptions) plus their own listings (My Listings), in one place. Reuses the same
 * RedemptionQueue/MyRedeemListings components the old /app/redeem "Manage" tab used; this
 * page just gives them a real URL and a stat summary instead of being buried in a tab.
 */
export default function RedeemManagePage() {
    const { isConnected } = useAccount()
    const isAdmin = useIsAdmin()
    const isPartnerRedeem = useIsPartnerRedeem()
    const canManage = isAdmin || isPartnerRedeem
    const [tab, setTab] = useState<'orders' | 'listings'>('orders')
    const { data: orders } = useAdminRedeemOrders()
    const { data: listings } = useMyRedeemItems()

    const stats = useMemo(() => {
        const os = orders ?? []
        return {
            total: os.length,
            awaitingShipment: os.filter((o) => o.status === 'Funded').length,
            shipped: os.filter((o) => o.status === 'Shipped').length,
            disputed: os.filter((o) => o.status === 'Disputed').length,
            listings: (listings ?? []).filter((i) => i.status === 'published').length,
        }
    }, [orders, listings])

    if (!isConnected || !canManage) {
        return (
            <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
                <Breadcrumb items={[{ label: 'Redeem', href: '/app/redeem' }, { label: 'Partner Panel' }]} />
                <EmptyState
                    title={isConnected ? "You don't have access to this page" : 'Connect your wallet'}
                    description={
                        isConnected
                            ? 'Only Registered Redeem partners and Admins can manage listings and redemptions.'
                            : 'Connect the wallet holding your Registered Redeem partner role to continue.'
                    }
                />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <Breadcrumb items={[{ label: 'Redeem', href: '/app/redeem' }, { label: 'Partner Panel' }]} />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Partner Panel</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Redemptions to fulfill and listings you manage.
                    </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/app/redeem/list">
                        <Plus className="mr-1.5 h-4 w-4" />
                        List item
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Package} label="Awaiting shipment" value={stats.awaitingShipment} />
                <StatCard icon={Truck} label="Shipped" value={stats.shipped} />
                <StatCard icon={PackageX} label="Disputed" value={stats.disputed} />
                <StatCard icon={PackageCheck} label="Published listings" value={stats.listings} />
            </div>

            <div>
                <div className="flex gap-1">
                    <Button type="button" size="sm" variant={tab === 'orders' ? 'secondary' : 'outline'} onClick={() => setTab('orders')}>
                        Redemptions ({stats.total})
                    </Button>
                    <Button type="button" size="sm" variant={tab === 'listings' ? 'secondary' : 'outline'} onClick={() => setTab('listings')}>
                        My Listings ({listings?.length ?? 0})
                    </Button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                    {tab === 'orders'
                        ? 'Merch orders against your listings — attach a tracking number to mark an order shipped.'
                        : 'Your Redeem listings — edit details, pricing, or unpublish.'}
                </p>
                <div className="mt-4">{tab === 'orders' ? <RedemptionQueue /> : <MyRedeemListings />}</div>
            </div>
        </div>
    )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: number }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                    <div className="text-lg font-semibold tabular-nums">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                </div>
            </CardContent>
        </Card>
    )
}
