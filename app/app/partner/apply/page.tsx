'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ShieldCheck, Clock, ShieldX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useIsPartnerMarketplace, useIsPartnerRedeem } from '@/hooks/useOnChainRoles'
import { useMyApplications, useSubmitApplication } from '@/hooks/useApplications'
import { toastSuccess, toastError } from '@/lib/toast'
import type { ApplicationKind, PartnerApplicationPayload } from '@/types/applications'

const EMPTY_FORM: PartnerApplicationPayload = { companyName: '', contactEmail: '', pitch: '' }

export default function PartnerApplyPage() {
    const { isConnected } = useAccount()
    const isPartnerMarketplace = useIsPartnerMarketplace()
    const isPartnerRedeem = useIsPartnerRedeem()

    if (!isConnected) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Connect your wallet"
                    description="Partner applications are tied to your wallet address. Connect first to apply."
                />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Partner Application</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Marketplace and Redeem partner rights are approved independently — apply for
                    either or both.
                </p>
            </div>

            <PartnerSection
                kind="partner_marketplace"
                title="Marketplace partner"
                description="Register new NFT collections/projects and list RWA items without per-listing approval."
                isApproved={isPartnerMarketplace}
            />
            <PartnerSection
                kind="partner_redeem"
                title="Redeem partner"
                description="Create Redeem catalog items (NFT and merch)."
                isApproved={isPartnerRedeem}
            />
        </div>
    )
}

function PartnerSection({
    kind,
    title,
    description,
    isApproved,
}: {
    kind: ApplicationKind
    title: string
    description: string
    isApproved: boolean
}) {
    const { data: applications } = useMyApplications(kind)
    const submit = useSubmitApplication()
    const [form, setForm] = useState(EMPTY_FORM)
    const latest = applications?.[0]
    const incomplete = !form.companyName.trim() || !form.contactEmail.trim() || !form.pitch.trim()

    if (isApproved) {
        return (
            <Card>
                <CardContent className="flex items-center gap-3 p-4">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
                    <div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground">Approved on-chain</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (latest?.status === 'pending') {
        return (
            <Card>
                <CardContent className="flex items-center gap-3 p-4">
                    <Clock className="h-5 w-5 shrink-0 text-amber-500" />
                    <div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground">Application under review</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    {title}
                    {latest?.status === 'rejected' && <Badge variant="outline">Previously rejected</Badge>}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {latest?.status === 'rejected' && (
                    <div className="flex items-center gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                        <ShieldX className="h-4 w-4 shrink-0 text-destructive" />
                        {latest.reject_reason ?? 'Your previous application was rejected.'}
                    </div>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor={`${kind}-company`}>Company / brand name</Label>
                    <Input
                        id={`${kind}-company`}
                        value={form.companyName}
                        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`${kind}-email`}>Contact email</Label>
                    <Input
                        id={`${kind}-email`}
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor={`${kind}-pitch`}>Tell us about your project</Label>
                    <Textarea
                        id={`${kind}-pitch`}
                        rows={3}
                        value={form.pitch}
                        onChange={(e) => setForm({ ...form, pitch: e.target.value })}
                    />
                </div>
                <Button
                    className="w-full"
                    disabled={incomplete || submit.isPending}
                    isLoading={submit.isPending}
                    loadingText="Submitting…"
                    onClick={() =>
                        submit.mutate(
                            { kind, payload: form },
                            {
                                onSuccess: () => {
                                    toastSuccess('Application submitted for review')
                                    setForm(EMPTY_FORM)
                                },
                                onError: (err) => toastError(err.message),
                            }
                        )
                    }
                >
                    Submit application
                </Button>
            </CardContent>
        </Card>
    )
}
