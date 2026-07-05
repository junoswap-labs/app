'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { GoogleLinkCard } from '@/components/settings/google-link-card'
import { TelegramLinkCard } from '@/components/settings/telegram-link-card'
import { useMockSettings } from '@/store/mock-settings'
import { useKycStatus } from '@/store/mock-kyc'

const KYC_BADGE: Record<string, { label: string; variant: 'secondary' | 'outline' }> = {
    unverified: { label: 'Not registered', variant: 'outline' },
    pending: { label: 'Under review', variant: 'secondary' },
    verified: { label: 'Verified seller', variant: 'secondary' },
    rejected: { label: 'Rejected', variant: 'outline' },
}

export default function SettingsPage() {
    const { address } = useAccount()
    const kycStatus = useKycStatus(address)
    const { notifyNewOffer, notifyDeadline, setNotify } = useMockSettings()

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Linked accounts</h2>
                <GoogleLinkCard />
                <TelegramLinkCard />
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Seller status</h2>
                <Card>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">KYC verification</p>
                                <p className="text-xs text-muted-foreground">
                                    Required to list NFTs or RWA items
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={KYC_BADGE[kycStatus].variant}>
                                {KYC_BADGE[kycStatus].label}
                            </Badge>
                            {kycStatus !== 'verified' && kycStatus !== 'pending' && (
                                <Button size="sm" asChild>
                                    <Link href="/app/register">Register</Link>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Notifications</h2>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Alert preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="notify-offer" className="text-sm">
                                    New offers on my listings
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    When someone buys or funds one of your items
                                </p>
                            </div>
                            <Switch
                                id="notify-offer"
                                checked={notifyNewOffer}
                                onCheckedChange={(v) => setNotify('notifyNewOffer', v)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label htmlFor="notify-deadline" className="text-sm">
                                    Deadline reminders
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Ship deadlines and dispute windows on your orders
                                </p>
                            </div>
                            <Switch
                                id="notify-deadline"
                                checked={notifyDeadline}
                                onCheckedChange={(v) => setNotify('notifyDeadline', v)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}
