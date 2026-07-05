import { Flame, Lock, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const PROGRAMS = [
    {
        icon: Flame,
        title: 'Program A: Burn',
        accent: 'text-orange-500',
        border: 'border-orange-500/30',
        gradient: 'from-orange-500/10',
        tagline: 'Trade your NFT forever for the highest rebate rate',
        points: [
            'One-time burnForRebate() — NFT goes to 0xdead permanently',
            'Highest rebate rate, up to a lifetime KUB cap',
            'Rewards stop when the cap is exhausted',
            'Supply shrinks — deflationary for the collection',
        ],
    },
    {
        icon: Lock,
        title: 'Program B: Stake',
        accent: 'text-emerald-500',
        border: 'border-emerald-500/30',
        gradient: 'from-emerald-500/10',
        tagline: 'Lock your NFT, earn steadily, withdraw anytime',
        points: [
            'stake() to lock in the contract — unstake() returns your NFT',
            'Lower rate, paid every epoch while staked',
            'Snapshot of the staked mapping at each epoch block',
            'Supply unchanged — your NFT stays yours',
        ],
    },
] as const

// Programs are assigned per-collection by admin — this section is informational only.
export function ProgramCompare() {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {PROGRAMS.map((p) => (
                <Card key={p.title} className={cn('relative overflow-hidden', p.border)}>
                    <div
                        className={cn(
                            'absolute inset-0 bg-gradient-to-br via-transparent to-transparent',
                            p.gradient
                        )}
                    />
                    <CardContent className="relative space-y-3 p-5">
                        <div className="flex items-center gap-2">
                            <p.icon className={cn('h-5 w-5', p.accent)} />
                            <h3 className="font-semibold">{p.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{p.tagline}</p>
                        <ul className="space-y-1.5 text-sm">
                            {p.points.map((point) => (
                                <li key={point} className="flex items-start gap-2">
                                    <Check className={cn('mt-0.5 h-4 w-4 shrink-0', p.accent)} />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
