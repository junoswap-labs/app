'use client'

import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { TelegramLinkCard } from '@/components/settings/telegram-link-card'
import { ListerProfileCard } from '@/components/settings/lister-profile-card'
import { useCurrentUser, useUpdateNotifyPrefs } from '@/hooks/useCurrentUser'
import { useIsAuthorized } from '@/hooks/useOnChainRoles'
import { useMyApplications } from '@/hooks/useApplications'

export default function SettingsPage() {
    const isAuthorized = useIsAuthorized()
    const { data: applications } = useMyApplications('authorize_rwa')
    const { data: me } = useCurrentUser()
    const updateNotify = useUpdateNotifyPrefs()

    const latest = applications?.[0]
    const sellerBadge = isAuthorized
        ? { label: 'Verified seller', variant: 'secondary' as const }
        : latest?.status === 'pending'
          ? { label: 'Under review', variant: 'secondary' as const }
          : latest?.status === 'rejected'
            ? { label: 'Rejected', variant: 'outline' as const }
            : { label: 'Not registered', variant: 'outline' as const }

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Linked accounts</h2>
                <TelegramLinkCard />
            </section>

            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">List By</h2>
                <ListerProfileCard />
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
                            <Badge variant={sellerBadge.variant}>{sellerBadge.label}</Badge>
                            {!isAuthorized && latest?.status !== 'pending' && (
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
                                checked={me?.notify_new_offer ?? true}
                                disabled={updateNotify.isPending}
                                onCheckedChange={(v) => updateNotify.mutate({ notify_new_offer: v })}
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
                                checked={me?.notify_deadline ?? true}
                                disabled={updateNotify.isPending}
                                onCheckedChange={(v) => updateNotify.mutate({ notify_deadline: v })}
                            />
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}
