'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { NftGrid } from '@/components/nft/nft-grid'
import { useCollectionConfig } from '@/hooks/useCollections'

export default function CollectionDetailPage({ params }: { params: Promise<{ contract: string }> }) {
    const { contract } = use(params)
    const address = decodeURIComponent(contract).toLowerCase() as `0x${string}`
    const { data: config, isLoading } = useCollectionConfig(address)

    if (!isLoading && !config) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Collection not registered"
                    description="This contract hasn't been registered on the marketplace yet."
                    action={
                        <Button asChild variant="outline">
                            <Link href="/app/collections">Back to Collections</Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link href="/app/collections">
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Collections
                </Link>
            </Button>

            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {config?.display_name ?? config?.name ?? 'Loading…'}
                    </h1>
                    {config?.verified && <BadgeCheck className="h-5 w-5 text-primary" />}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{address}</p>
            </div>

            <NftGrid contract={address} />
        </div>
    )
}
