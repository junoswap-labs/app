'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { RwaCard } from '@/components/rwa/rwa-card'
import { useMockRwa } from '@/store/mock-rwa'

export function RwaGrid() {
    const listings = useMockRwa((s) => s.listings).filter(
        (l) => !['cancelled', 'refunded', 'resolved'].includes(l.status)
    )

    return (
        <div className="space-y-5">
            <div className="flex justify-end">
                <Button asChild size="sm">
                    <Link href="/app/rwa/list">
                        <Plus className="mr-1.5 h-4 w-4" /> List an item
                    </Link>
                </Button>
            </div>

            {listings.length === 0 ? (
                <EmptyState
                    title="No RWA listings yet"
                    description="List a real-world asset to start trading with escrow protection."
                />
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {listings.map((l) => (
                        <RwaCard key={l.id} listing={l} />
                    ))}
                </div>
            )}
        </div>
    )
}
