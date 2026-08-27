import { ShieldCheck, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RedeemTier } from '@/types/redeem'

interface ListerProfile {
    lister_display_name: string | null
    lister_logo_url: string | null
}

function shortWallet(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * Pure/presentational "Listed by …" line, reused on the catalog card, item detail page, and order
 * rows. Deliberately takes a resolved `profile` instead of fetching one itself — a catalog grid of
 * many items batches a single useListerProfiles(wallets) call and passes each item's result down,
 * rather than firing one query per card.
 */
export function ListedBy({
    tier,
    listerWallet,
    profile,
    className,
}: {
    tier: RedeemTier
    listerWallet: string
    profile?: ListerProfile
    className?: string
}) {
    if (tier === 'official') {
        return (
            <Badge variant="outline" className={className}>
                <ShieldCheck className="mr-1 h-3 w-3" /> Official
            </Badge>
        )
    }

    const name = profile?.lister_display_name || shortWallet(listerWallet)
    return (
        <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className ?? ''}`}>
            {profile?.lister_logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={profile.lister_logo_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-4 w-4 rounded-full object-cover"
                />
            ) : (
                <Store className="h-3.5 w-3.5" />
            )}
            <span>Listed by {name}</span>
        </div>
    )
}
