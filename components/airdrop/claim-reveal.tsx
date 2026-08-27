'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ClaimRevealProps {
    /** null while the claim is still in flight — shows a spinning placeholder until it lands. */
    amount: number | null
    symbol: string
    className?: string
}

const SPIN_DURATION_MS = 1100

/**
 * Slot-machine-style reveal for a claim: spins through random placeholder digits while the claim is
 * in flight, then counts up (ease-out) to the real amount once it's known and settles with a pulse.
 * The caller decides *when* to mount this — on the claim page that's only after the wallet has
 * broadcast the tx, so the digits never roll while the user is still staring at MetaMask.
 * Hand-rolled with a plain interval/rAF rather than a new animation dependency.
 */
export function ClaimReveal({ amount, symbol, className }: ClaimRevealProps) {
    const [display, setDisplay] = useState(0)
    const [settled, setSettled] = useState(false)
    const spinning = amount == null

    useEffect(() => {
        if (amount == null) {
            setSettled(false)
            let alive = true
            const spin = () => {
                if (!alive) return
                setDisplay(Math.random() * 999)
                timeoutId = window.setTimeout(spin, 60)
            }
            let timeoutId = window.setTimeout(spin, 60)
            return () => {
                alive = false
                window.clearTimeout(timeoutId)
            }
        }

        const start = performance.now()
        let rafId = 0
        const animate = (now: number) => {
            const t = Math.min(1, (now - start) / SPIN_DURATION_MS)
            const eased = 1 - Math.pow(1 - t, 3)
            setDisplay(amount * eased)
            if (t < 1) {
                rafId = requestAnimationFrame(animate)
            } else {
                setDisplay(amount)
                setSettled(true)
            }
        }
        rafId = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(rafId)
    }, [amount])

    return (
        <div className={cn('relative flex flex-col items-center gap-1', className)}>
            {spinning && (
                <span className="pointer-events-none absolute -inset-x-6 inset-y-0 rounded-2xl bg-foreground/[0.04] motion-safe:animate-pulse" />
            )}
            <span
                className={cn(
                    'relative text-4xl font-bold tabular-nums tracking-tight transition-all duration-300',
                    // blurred + dimmed while the digits are meaningless, snapping sharp on settle
                    spinning && 'text-muted-foreground blur-[1.5px]',
                    settled && 'scale-110'
                )}
            >
                {display.toLocaleString(undefined, { maximumFractionDigits: spinning ? 2 : 4 })}
            </span>
            <span className="relative text-sm font-medium text-muted-foreground">{symbol}</span>
        </div>
    )
}
