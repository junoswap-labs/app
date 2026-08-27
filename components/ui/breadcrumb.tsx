import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbSegment {
    label: string
    href?: string
}

export function Breadcrumb({ items, className }: { items: BreadcrumbSegment[]; className?: string }) {
    return (
        <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm text-muted-foreground', className)}>
            {items.map((item, i) => {
                const isLast = i === items.length - 1
                return (
                    <span key={i} className="flex min-w-0 items-center gap-1.5">
                        {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                        {item.href && !isLast ? (
                            <Link href={item.href} className="truncate transition-colors hover:text-foreground">
                                {item.label}
                            </Link>
                        ) : (
                            <span className={cn('truncate', isLast && 'font-medium text-foreground')}>{item.label}</span>
                        )}
                    </span>
                )
            })}
        </nav>
    )
}
