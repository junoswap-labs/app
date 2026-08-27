'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useChainId } from 'wagmi'
import { Menu } from 'lucide-react'
import { bitkub } from '@/lib/wagmi'
import { ConnectButton } from '@/components/web3/connect-button'
import { NetworkSwitcher } from '@/components/web3/network-switcher'
import { NotificationBell } from '@/components/marketplace/notification-bell'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Marketplace/Collections/Rebate/Orders are temporarily hidden while development is focused on
// Redeem (see CLAUDE.md) — routes still exist and are directly reachable by URL, only the nav
// entries are removed. Re-add their entries here to bring them back.
// "Manage" (Redemptions/My Listings) lives as a tab on /app/redeem itself now, not a separate
// nav entry — see app/app/redeem/page.tsx. Settings and Admin aren't here either: both hang off
// the wallet dropdown (components/web3/account-dropdown.tsx), Admin only for wallets holding the
// on-chain role.
// Redeem isn't live on KUB mainnet yet — hide its nav entry there (route still URL-reachable,
// same as the other temporarily-hidden features above). Visible on testnet.
const NAV_LINKS = [
    { href: '/app/redeem', label: 'Redeem', mainnet: false },
    { href: '/app/airdrop', label: 'Airdrop', mainnet: true },
] as const

function isLinkActive(pathname: string, href: string) {
    return pathname.startsWith(href)
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    const chainId = useChainId()
    const links = NAV_LINKS.filter((link) => link.mainnet || chainId !== bitkub.id)
    return (
        <>
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={cn(
                        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isLinkActive(pathname, link.href)
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {link.label}
                </Link>
            ))}
        </>
    )
}

export function Header() {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                <Link
                    href="/app/redeem"
                    className="flex items-center gap-1.5 font-semibold tracking-tight"
                >
                    <Image src="/logo.svg" alt="" width={24} height={24} priority />
                    <span className="bg-gradient-to-r from-primary to-[#FF914D] bg-clip-text text-transparent">
                        Junoswap
                    </span>
                    <span className="text-muted-foreground">App</span>
                </Link>

                <nav className="hidden items-center gap-1 sm:flex">
                    <NavLinks pathname={pathname} />
                </nav>

                <div className="flex items-center gap-1">
                    <NetworkSwitcher className="hidden sm:flex" />
                    <NotificationBell />
                    <ConnectButton />
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="sm:hidden"
                                aria-label="Open menu"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-64">
                            <nav className="mt-8 flex flex-col gap-1">
                                <NavLinks
                                    pathname={pathname}
                                    onNavigate={() => setMobileOpen(false)}
                                />
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
