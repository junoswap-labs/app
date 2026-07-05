'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { ConnectButton } from '@/components/web3/connect-button'
import { NetworkSwitcher } from '@/components/web3/network-switcher'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useIsAdmin } from '@/hooks/useCurrentUser'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
    { href: '/app', label: 'Marketplace', adminOnly: false },
    { href: '/app/rebate', label: 'Rebate', adminOnly: false },
    { href: '/app/redeem', label: 'Redeem', adminOnly: false },
    { href: '/app/orders', label: 'Orders', adminOnly: false },
    { href: '/app/settings', label: 'Settings', adminOnly: false },
    { href: '/app/admin', label: 'Admin', adminOnly: true },
] as const

function isLinkActive(pathname: string, href: string) {
    // '/app' is also the prefix of every other link, so it only matches marketplace routes
    if (href === '/app') {
        const rest = pathname.slice(href.length)
        return rest === '' || rest.startsWith('/nft') || rest.startsWith('/rwa')
    }
    return pathname.startsWith(href)
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    const isAdmin = useIsAdmin()
    return (
        <>
            {NAV_LINKS.filter((link) => !link.adminOnly || isAdmin).map((link) => (
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
                    href="/app"
                    className="flex items-center gap-1.5 font-semibold tracking-tight"
                >
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
