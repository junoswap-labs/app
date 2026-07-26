'use client'

import Link from 'next/link'
import { ShieldAlert, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useIsAuthorized } from '@/hooks/useOnChainRoles'
import { useMyApplications } from '@/hooks/useApplications'

// Wraps RWA listing — only wallets holding PermissionRegistry's AUTHORIZE_ROLE may list.
// The on-chain role is the real gate; the 'authorize_rwa' application status is only used here
// to show a friendlier "pending review" message while the on-chain grant hasn't landed yet.
export function AuthorizeGate({ children }: { children: React.ReactNode }) {
    const isAuthorized = useIsAuthorized()
    const { data: applications } = useMyApplications('authorize_rwa')

    if (isAuthorized) return <>{children}</>

    const latest = applications?.[0]
    const pending = latest?.status === 'pending'

    return (
        <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                {pending ? (
                    <Clock className="h-8 w-8 text-amber-500" />
                ) : (
                    <ShieldAlert className="h-8 w-8 text-primary" />
                )}
                <h2 className="text-lg font-semibold tracking-tight">
                    {pending ? 'Verification in progress' : 'Seller verification required'}
                </h2>
                <p className="max-w-md text-sm text-muted-foreground">
                    {pending
                        ? 'Your application is being reviewed. Listing unlocks as soon as an admin approves it on-chain.'
                        : 'For buyer safety, listing RWA items requires a one-time identity verification.'}
                </p>
                {!pending && (
                    <Button asChild className="mt-1">
                        <Link href="/app/register">Register as a seller</Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
