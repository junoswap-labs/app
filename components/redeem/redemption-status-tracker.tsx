import { Check, X, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RedeemKind, RedemptionStatus } from '@/types/redeem'

// NFT kind settles atomically (RedeemNftSettlement.redeem()); merch kind reuses RwaEscrow.sol
// directly, so its steps mirror that contract's own Status enum from Funded onward — see
// types/redeem.ts's header comment on RedemptionStatus for why.
const NFT_STEPS: { status: RedemptionStatus; label: string }[] = [
    { status: 'PendingPayment', label: 'Payment' },
    { status: 'Completed', label: 'Delivered' },
]
const MERCH_STEPS: { status: RedemptionStatus; label: string }[] = [
    { status: 'PendingPayment', label: 'Payment' },
    { status: 'Funded', label: 'Escrowed' },
    { status: 'Shipped', label: 'Shipped' },
    { status: 'Completed', label: 'Completed' },
]

const BRANCH: Partial<Record<RedemptionStatus, { icon: typeof X; tone: string; label: string }>> = {
    Refunded: { icon: X, tone: 'text-destructive bg-destructive/15', label: 'Refunded — payment returned to buyer' },
    Disputed: { icon: Scale, tone: 'text-amber-600 bg-amber-500/15', label: 'Disputed — awaiting arbitrator resolution' },
    ResolvedSeller: { icon: Check, tone: 'text-primary bg-primary/15', label: 'Dispute resolved — released to the lister' },
    ResolvedBuyer: { icon: X, tone: 'text-destructive bg-destructive/15', label: 'Dispute resolved — refunded to buyer' },
}

/** Step bar for a redemption order — status comes from the server (poller-written) only, no
 *  client-side guessing. Shared by the item detail page, My Redemptions, and the fulfillment queue. */
export function RedemptionStatusTracker({ status, kind }: { status: RedemptionStatus; kind: RedeemKind }) {
    const branch = BRANCH[status]
    if (branch) {
        const Icon = branch.icon
        return (
            <div className={cn('flex items-center gap-2 text-sm', branch.tone.split(' ')[0])}>
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', branch.tone.split(' ')[1])}>
                    <Icon className="h-3.5 w-3.5" />
                </span>
                {branch.label}
            </div>
        )
    }

    const steps = kind === 'nft' ? NFT_STEPS : MERCH_STEPS
    const activeIndex = steps.findIndex((s) => s.status === status)

    return (
        <ol className="flex items-center gap-1.5">
            {steps.map((step, i) => {
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
                            <span className={cn('text-xs', current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                                {step.label}
                            </span>
                        </span>
                        {i < steps.length - 1 && (
                            <span className={cn('h-px w-4 sm:w-8', i < activeIndex ? 'bg-primary' : 'bg-border')} aria-hidden />
                        )}
                    </li>
                )
            })}
        </ol>
    )
}
