'use client'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { AirdropTxPhase } from '@/hooks/useAirdropActions'

const LABEL: Record<Exclude<AirdropTxPhase, 'idle'>, string> = {
    checking: 'Checking your eligibility…',
    approving: 'Approving the token spend…',
    signing: 'Confirm in your wallet',
    pending: 'Waiting for the network…',
    saving: 'Saving campaign details…',
}

const HINT: Record<Exclude<AirdropTxPhase, 'idle'>, string> = {
    checking: 'Verifying this claim against the campaign rules.',
    approving: 'Your wallet may ask you to approve the token first.',
    signing: 'Open your wallet and approve the transaction.',
    pending: 'Transaction sent — this usually takes a few seconds.',
    saving: 'Almost there.',
}

/**
 * `signing` is the one step blocked on the user, so it gets a still ring and an instruction; every
 * other step keeps spinning to show work is ongoing.
 */
function Spinner({ waitingOnUser, className }: { waitingOnUser: boolean; className?: string }) {
    return (
        <span className={cn('relative flex shrink-0 items-center justify-center', className)}>
            {!waitingOnUser && (
                <span className="absolute inset-0 rounded-full bg-foreground/10 motion-safe:animate-ping" />
            )}
            <svg
                viewBox="0 0 32 32"
                className={cn('h-full w-full', !waitingOnUser && 'motion-safe:animate-spin')}
                aria-hidden
            >
                <circle cx="16" cy="16" r="12" fill="none" strokeWidth="2.5" className="stroke-border" />
                {/* one quarter-arc of the 2πr≈75.4 circumference, so the gap reads as motion */}
                <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="19 57"
                    className="stroke-foreground"
                />
            </svg>
        </span>
    )
}

/** Inline animated wait indicator for a multi-step write. */
export function TxProgress({ phase, className }: { phase: AirdropTxPhase; className?: string }) {
    if (phase === 'idle') return null

    return (
        <div
            className={cn('flex items-center gap-3 rounded-lg border bg-muted/40 p-3', className)}
            role="status"
            aria-live="polite"
        >
            <Spinner waitingOnUser={phase === 'signing'} className="h-8 w-8" />
            <div className="min-w-0">
                <p className="text-sm font-medium">{LABEL[phase]}</p>
                <p className="truncate text-xs text-muted-foreground">{HINT[phase]}</p>
            </div>
        </div>
    )
}

/**
 * Centered modal wrapper around the same indicator. Non-dismissible on purpose — the tx is already
 * in flight, so closing would only hide state the user needs to see.
 */
export function TxProgressDialog({ phase }: { phase: AirdropTxPhase }) {
    return (
        <Dialog open={phase !== 'idle'}>
            <DialogContent
                className="max-w-xs [&>button]:hidden"
                onEscapeKeyDown={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                {phase !== 'idle' && (
                    <div className="flex flex-col items-center gap-4 py-2 text-center">
                        <Spinner waitingOnUser={phase === 'signing'} className="h-14 w-14" />
                        <div className="space-y-1.5">
                            <DialogTitle className="text-base">{LABEL[phase]}</DialogTitle>
                            <DialogDescription>{HINT[phase]}</DialogDescription>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
