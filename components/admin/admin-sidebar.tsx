'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AdminSection {
    key: string
    label: string
}

export interface AdminGroup {
    key: string
    label: string
    sections: AdminSection[]
}

interface Props {
    groups: AdminGroup[]
    active: string
    onSelect: (key: string) => void
    collapsed: string[]
    onToggleGroup: (key: string) => void
}

/**
 * Eleven flat tabs stopped fitting on one row, and a wrapped tab strip gives no hint about which
 * things belong together. Grouping them makes the list scannable, and collapsing a group the
 * operator isn't using keeps the rail short as more sections land.
 */
export function AdminSidebar({ groups, active, onSelect, collapsed, onToggleGroup }: Props) {
    return (
        <>
            {/* Mobile: a native select — a 200px rail plus content doesn't fit a phone, and this
                needs no extra state or portal to work. */}
            <select
                className="mb-4 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm lg:hidden"
                value={active}
                onChange={(e) => onSelect(e.target.value)}
            >
                {groups.map((group) => (
                    <optgroup key={group.key} label={group.label}>
                        {group.sections.map((section) => (
                            <option key={section.key} value={section.key}>
                                {section.label}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>

            <nav className="hidden lg:block">
                {groups.map((group) => {
                    const isCollapsed = collapsed.includes(group.key)
                    return (
                        <div key={group.key} className="mb-1">
                            <button
                                type="button"
                                onClick={() => onToggleGroup(group.key)}
                                aria-expanded={!isCollapsed}
                                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {group.label}
                                <ChevronDown
                                    className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && '-rotate-90')}
                                    aria-hidden
                                />
                            </button>

                            {!isCollapsed && (
                                <div className="mt-0.5 space-y-0.5">
                                    {group.sections.map((section) => (
                                        <button
                                            key={section.key}
                                            type="button"
                                            onClick={() => onSelect(section.key)}
                                            className={cn(
                                                'w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                                                section.key === active
                                                    ? 'bg-muted font-medium text-foreground'
                                                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                            )}
                                        >
                                            {section.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </nav>
        </>
    )
}
