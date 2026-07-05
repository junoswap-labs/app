import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RedemptionStatus } from '@/types/redeem'

const STEPS: { status: RedemptionStatus; label: string }[] = [
    { status: 'submitted', label: 'Submitted' },
    { status: 'verified', label: 'Verified' },
    { status: 'shipped', label: 'Shipped' },
    { status: 'completed', label: 'Completed' },
]

// Step bar for RWA/merch redemptions — receives status from the server only, no internal guesses.
export function RedemptionStatusTracker({ status }: { status: RedemptionStatus }) {
    if (status === 'rejected') {
        return (
            <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15">
                    <X className="h-3.5 w-3.5" />
                </span>
                Verification rejected — refund in progress
            </div>
        )
    }

    const activeIndex = STEPS.findIndex((s) => s.status === status)

    return (
        <ol className="flex items-center gap-1.5">
            {STEPS.map((step, i) => {
                const done = i < activeIndex
                const current = i === activeIndex
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
                                    current ? 'font-medium text-foreground' : 'text-muted-foreground'
                                )}
                            >
                                {step.label}
                            </span>
                        </span>
                        {i < STEPS.length - 1 && (
                            <span
                                className={cn(
                                    'h-px w-4 sm:w-8',
                                    i < activeIndex ? 'bg-primary' : 'bg-border'
                                )}
                                aria-hidden
                            />
                        )}
                    </li>
                )
            })}
        </ol>
    )
}
