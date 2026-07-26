'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ShieldCheck, Clock, ShieldX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useIsAuthorized } from '@/hooks/useOnChainRoles'
import { useMyApplications, useSubmitApplication } from '@/hooks/useApplications'
import { toastSuccess, toastError } from '@/lib/toast'

const EMPTY_FORM = { fullName: '', idNumber: '', phone: '', email: '', address: '' }

export default function RegisterPage() {
    const { address, isConnected } = useAccount()
    const isAuthorized = useIsAuthorized()
    const { data: applications } = useMyApplications('authorize_rwa')
    const submit = useSubmitApplication()
    const [form, setForm] = useState(EMPTY_FORM)
    const [docName, setDocName] = useState<string | undefined>()

    if (!isConnected || !address) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Connect your wallet"
                    description="Seller registration is tied to your wallet address. Connect first to register."
                />
            </div>
        )
    }

    const latest = applications?.[0]

    if (isAuthorized) {
        return (
            <StatusScreen
                icon={<ShieldCheck className="h-8 w-8 text-emerald-500" />}
                title="You're a verified seller"
                description="Your wallet holds the Authorize role on-chain. You can list RWA items on the marketplace."
            />
        )
    }

    if (latest?.status === 'pending') {
        return (
            <StatusScreen
                icon={<Clock className="h-8 w-8 text-amber-500" />}
                title="Verification in progress"
                description="Your application is being reviewed. You'll be able to list RWA items once an admin approves it on-chain."
            />
        )
    }

    const incomplete = Object.values(form).some((v) => !v.trim())

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Seller Registration</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Listing RWA items on the marketplace requires identity verification for buyer
                    safety. Your information is reviewed by the team and never shown publicly.
                </p>
            </div>

            {latest?.status === 'rejected' && (
                <Card className="border-destructive/40 bg-destructive/5">
                    <CardContent className="flex items-center gap-2.5 p-4 text-sm">
                        <ShieldX className="h-4 w-4 shrink-0 text-destructive" />
                        Your previous application was rejected
                        {latest.reject_reason ? `: ${latest.reject_reason}` : '.'} Please check your
                        details and submit again.
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Identity details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                            id="fullName"
                            label="Full legal name"
                            value={form.fullName}
                            onChange={(v) => setForm({ ...form, fullName: v })}
                        />
                        <Field
                            id="idNumber"
                            label="National ID / Passport no."
                            value={form.idNumber}
                            onChange={(v) => setForm({ ...form, idNumber: v })}
                        />
                        <Field
                            id="phone"
                            label="Phone"
                            value={form.phone}
                            onChange={(v) => setForm({ ...form, phone: v })}
                        />
                        <Field
                            id="email"
                            label="Email"
                            value={form.email}
                            onChange={(v) => setForm({ ...form, email: v })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                            id="address"
                            rows={3}
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="idDoc">ID document (photo of ID card / passport)</Label>
                        <Input
                            id="idDoc"
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => setDocName(e.target.files?.[0]?.name)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Uploaded to private storage — only reviewers can access it.
                        </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        Registering wallet: <span className="font-mono">{address}</span>
                    </div>
                    <Button
                        className="w-full"
                        disabled={incomplete || submit.isPending}
                        isLoading={submit.isPending}
                        loadingText="Submitting…"
                        onClick={() => {
                            if (!docName) {
                                toastError('Please attach your ID document')
                                return
                            }
                            submit.mutate(
                                {
                                    kind: 'authorize_rwa',
                                    payload: { ...form, idDocumentName: docName },
                                },
                                {
                                    onSuccess: () => toastSuccess('Application submitted for review'),
                                    onError: (err) => toastError(err.message),
                                }
                            )
                        }}
                    >
                        Submit for verification
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

function Field({
    id,
    label,
    value,
    onChange,
}: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    )
}

function StatusScreen({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode
    title: string
    description: string
}) {
    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    {icon}
                    <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                    <p className="max-w-md text-sm text-muted-foreground">{description}</p>
                </CardContent>
            </Card>
        </div>
    )
}
