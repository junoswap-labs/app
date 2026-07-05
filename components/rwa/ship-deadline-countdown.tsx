'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// Countdown to a deadline (ship/receive) — display only; the contract enforces the real deadline.
export function DeadlineCountdown({ deadline, label }: { deadline: number; label: string }) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 60_000)
        return () => clearInterval(t)
    }, [])

    const remaining = deadline - now
    const expired = remaining <= 0
    const days = Math.floor(remaining / 86_400_000)
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000)

    return (
        <div
            className={cn(
                'flex items-center gap-1.5 text-xs',
                expired ? 'text-destructive' : 'text-muted-foreground'
            )}
        >
            <Clock className="h-3.5 w-3.5" />
            {expired ? `${label} deadline passed` : `${label}: ${days}d ${hours}h left`}
        </div>
    )
}
