'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMyRedeemOrders } from '@/hooks/useRedeemOrders'
import type { RedemptionStatus } from '@/types/redeem'

// Last time this browser opened the bell. Kept in localStorage rather than the DB: "have I looked
// at this yet" is per-device, and adding a read-receipt column would put a write on every open.
const SEEN_KEY = 'juno.notifications.seen-at'
const MAX_ITEMS = 8

const STATUS_TEXT: Record<RedemptionStatus, string> = {
    PendingPayment: 'is waiting for payment',
    Funded: 'is paid — preparing your item',
    Shipped: 'has shipped',
    Completed: 'is complete',
    Refunded: 'was refunded',
    Disputed: 'is in dispute',
    ResolvedSeller: 'was resolved in the seller’s favour',
    ResolvedBuyer: 'was resolved in your favour',
}

function timeAgo(iso: string): string {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell() {
    const { address } = useAccount()
    const { data: orders } = useMyRedeemOrders(Boolean(address))
    const [seenAt, setSeenAt] = useState<number | null>(null)

    // Read after mount only — localStorage isn't available during SSR and reading it in render
    // would make the unread dot hydrate differently on server and client.
    useEffect(() => {
        setSeenAt(Number(window.localStorage.getItem(SEEN_KEY) ?? 0))
    }, [])

    const items = [...(orders ?? [])]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, MAX_ITEMS)
    const unread = seenAt === null ? 0 : items.filter((o) => new Date(o.updated_at).getTime() > seenAt).length

    const markSeen = () => {
        const now = Date.now()
        window.localStorage.setItem(SEEN_KEY, String(now))
        setSeenAt(now)
    }

    return (
        <DropdownMenu onOpenChange={(open) => open && markSeen()}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-card/95 backdrop-blur-md">
                <div className="px-3 py-2 text-sm font-medium">Notifications</div>
                {items.length === 0 ? (
                    <p className="px-3 pb-3 text-xs text-muted-foreground">
                        {address ? 'Nothing yet — your redemption updates will show up here.' : 'Connect your wallet to see updates.'}
                    </p>
                ) : (
                    <ul className="max-h-80 overflow-y-auto pb-1">
                        {items.map((order) => (
                            <li key={order.id}>
                                <Link
                                    href="/app/redeem/orders"
                                    className="block px-3 py-2 text-xs transition-colors hover:bg-muted/50"
                                >
                                    <span className="font-medium">{order.item_name ?? 'Your redemption'}</span>{' '}
                                    <span className="text-muted-foreground">{STATUS_TEXT[order.status]}</span>
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                                        {timeAgo(order.updated_at)}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
