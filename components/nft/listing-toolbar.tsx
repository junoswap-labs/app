'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { ListingQuery, ListingSort, ListingStatus } from '@/types/marketplace'
import { cn } from '@/lib/utils'

interface ToolbarProps {
    query: ListingQuery
    onChange: (q: ListingQuery) => void
}

const STATUS: { value: ListingStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'For sale' },
    { value: 'sold', label: 'Sold' },
]

const SORT: { value: ListingSort; label: string }[] = [
    { value: 'recent', label: 'Recent' },
    { value: 'price_asc', label: 'Price ↑' },
    { value: 'price_desc', label: 'Price ↓' },
]

function Segmented<T extends string>({
    options,
    value,
    onSelect,
}: {
    options: { value: T; label: string }[]
    value: T
    onSelect: (v: T) => void
}) {
    return (
        <div className="inline-flex rounded-lg border p-0.5">
            {options.map((o) => (
                <Button
                    key={o.value}
                    type="button"
                    size="sm"
                    variant={value === o.value ? 'secondary' : 'ghost'}
                    className={cn('h-7 px-3', value !== o.value && 'text-muted-foreground')}
                    onClick={() => onSelect(o.value)}
                >
                    {o.label}
                </Button>
            ))}
        </div>
    )
}

export function ListingToolbar({ query, onChange }: ToolbarProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query.search}
                    onChange={(e) => onChange({ ...query, search: e.target.value })}
                    placeholder="Search name or token id…"
                    className="pl-9"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Segmented
                    options={STATUS}
                    value={query.status}
                    onSelect={(status) => onChange({ ...query, status })}
                />
                <Segmented
                    options={SORT}
                    value={query.sort}
                    onSelect={(sort) => onChange({ ...query, sort })}
                />
            </div>
        </div>
    )
}
