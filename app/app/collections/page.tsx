'use client'

import Link from 'next/link'
import { BadgeCheck, ImageOff, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useCollections } from '@/hooks/useCollections'

export default function CollectionsPage() {
    const { data: collections, isLoading } = useCollections()

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Browse Marketplace listings grouped by NFT project.
                    </p>
                </div>
                <Button asChild size="sm">
                    <Link href="/app/collections/register">
                        <Plus className="mr-1.5 h-4 w-4" />
                        Register a collection
                    </Link>
                </Button>
            </div>

            {!isLoading && (!collections || collections.length === 0) ? (
                <EmptyState
                    title="No collections registered yet"
                    description="Register your NFT contract to make its tokens listable on the marketplace."
                />
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {collections?.map((c) => (
                        <Link key={`${c.contract}-${c.chain_id}`} href={`/app/collections/${c.contract}`}>
                            <Card className="overflow-hidden transition-shadow hover:shadow-md">
                                <div className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">
                                    <ImageOff className="h-6 w-6" />
                                </div>
                                <CardContent className="space-y-1 p-3">
                                    <div className="flex items-center gap-1">
                                        <span className="truncate text-sm font-medium">
                                            {c.display_name ?? c.name}
                                        </span>
                                        {c.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                                    </div>
                                    <p className="truncate font-mono text-xs text-muted-foreground">{c.contract}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
