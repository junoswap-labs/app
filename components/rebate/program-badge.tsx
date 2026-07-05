import { Flame, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RebateProgram } from '@/types/rebate'

export function ProgramBadge({
    program,
    className,
}: {
    program: RebateProgram
    className?: string
}) {
    const burn = program === 'burn'
    return (
        <Badge
            variant="outline"
            className={cn(
                burn
                    ? 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                className
            )}
        >
            {burn ? <Flame className="mr-1 h-3 w-3" /> : <Lock className="mr-1 h-3 w-3" />}
            {burn ? 'Burn' : 'Stake'}
        </Badge>
    )
}
