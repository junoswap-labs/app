import { Check, TriangleAlert, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RwaStatus } from '@/types/rwa'

const HAPPY_PATH: { status: RwaStatus; label: string }[] = [
    { status: 'funded', label: 'Funded' },
    { status: 'shipped', label: 'Shipped' },
    { status: 'completed', label: 'Completed' },
]

// Central step bar for RWA orders — receives status from the server only, no internal state.
export function OrderStatusTracker({ status }: { status: RwaStatus }) {
    if (status === 'refunded') {
        return (
            <Branch icon={<Undo2 className="h-3.5 w-3.5" />} label="Refunded — escrow returned to buyer" />
        )
    }
    if (status === 'disputed') {
        return (
            <Branch
                icon={<TriangleAlert className="h-3.5 w-3.5" />}
                label="Disputed — waiting for arbitrator"
                warn
            />
        )
    }
    if (status === 'resolved') {
        return <Branch icon={<Check className="h-3.5 w-3.5" />} label="Resolved by arbitrator" />
    }

    const activeIndex = HAPPY_PATH.findIndex((s) => s.status === status)

    return (
        <ol className="flex items-center gap-1.5">
            {HAPPY_PATH.map((step, i) => {
                const done = activeIndex >= 0 && (i < activeIndex || status === 'completed')
                const current = i === activeIndex && status !== 'completed'
                return (
                    <li key={step.status} className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1.5">
                            <span
                                className={cn(
                                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                                    done && 'bg-primary text-primary-foreground',
                                    current && 'bg-primary/20 text-primary ring-1 ring-primary',
                                    !done && !current && 'bg-muted text-muted-foreground'
                                )}
                            >
                                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                            </span>
                            <span
                                className={cn(
                                    'text-xs',
                                    current || done
                                        ? 'font-medium text-foreground'
                                        : 'text-muted-foreground'
                                )}
                            >
                                {step.label}
                            </span>
                        </span>
                        {i < HAPPY_PATH.length - 1 && (
                            <span
                                className={cn('h-px w-4 sm:w-8', done ? 'bg-primary' : 'bg-border')}
                                aria-hidden
                            />
                        )}
                    </li>
                )
            })}
        </ol>
    )
}

function Branch({ icon, label, warn }: { icon: React.ReactNode; label: string; warn?: boolean }) {
    return (
        <div
            className={cn(
                'flex items-center gap-2 text-sm',
                warn ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            )}
        >
            <span
                className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    warn ? 'bg-amber-500/15' : 'bg-muted'
                )}
            >
                {icon}
            </span>
            {label}
        </div>
    )
}
