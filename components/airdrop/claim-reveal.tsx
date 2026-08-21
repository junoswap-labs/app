'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ClaimRevealProps {
    /** null while the claim is still in flight — shows a spinning placeholder until it lands. */
    amount: number | null
    symbol: string
    className?: string
}

const SPIN_DURATION_MS = 900

/**
 * Slot-machine-style reveal for a random-amount claim: spins through random placeholder digits
 * while the claim is pending, then counts up (ease-out) to the real amount once it's known and
 * settles with a small scale pulse. Hand-rolled with a plain interval/rAF rather than a new
 * animation dependency — matches this repo's minimal-dependency approach.
 */
export function ClaimReveal({ amount, symbol, className }: ClaimRevealProps) {
    const [display, setDisplay] = useState(0)
    const [settled, setSettled] = useState(false)

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
        <div
            className={cn(
                'flex flex-col items-center gap-1 transition-transform duration-300',
                settled && 'scale-110',
                className
            )}
        >
            <span className="text-4xl font-bold tabular-nums tracking-tight">
                {display.toLocaleString(undefined, { maximumFractionDigits: amount == null ? 2 : 4 })}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{symbol}</span>
        </div>
    )
}
