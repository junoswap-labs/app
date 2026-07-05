'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ShieldAlert, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useKycStatus } from '@/store/mock-kyc'

// Wraps listing flows — only KYC-verified sellers may list on the marketplace.
// This gate is UX only; the real check is enforced server-side when the listing is submitted.
export function KycGate({ children }: { children: React.ReactNode }) {
    const { address } = useAccount()
    const status = useKycStatus(address)

    if (status === 'verified') return <>{children}</>

    const pending = status === 'pending'

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
                        ? 'Your KYC application is being reviewed. Listing unlocks as soon as you are verified.'
                        : 'For buyer safety, listing NFTs or RWA items requires a one-time identity verification (KYC).'}
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
