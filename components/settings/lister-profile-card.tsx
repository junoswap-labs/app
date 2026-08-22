'use client'

import { useEffect, useState } from 'react'
import { Store } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUploadField } from '@/components/ui/image-upload'
import { useIsPartnerRedeem } from '@/hooks/useOnChainRoles'
import { useMyListerProfile, useUpdateListerProfile } from '@/hooks/useListerProfile'
import { toastSuccess, toastError } from '@/lib/toast'

/** "List By" branding for Registered Redeem partners — a custom display name + logo shown on
 *  their catalog items instead of a raw wallet address. Only rendered/editable once the wallet
 *  holds PARTNER_REDEEM_ROLE; the API itself also enforces this on write. */
export function ListerProfileCard() {
    const isPartnerRedeem = useIsPartnerRedeem()
    const { data: profile } = useMyListerProfile()
    const update = useUpdateListerProfile()

    const [name, setName] = useState('')
    const [logoUrl, setLogoUrl] = useState<string | null>(null)

    useEffect(() => {
        if (profile) {
            setName(profile.lister_display_name ?? '')
            setLogoUrl(profile.lister_logo_url ?? null)
        }
    }, [profile])

    if (!isPartnerRedeem) return null

    const dirty = name !== (profile?.lister_display_name ?? '') || logoUrl !== (profile?.lister_logo_url ?? null)

    const save = async () => {
        try {
            await update.mutateAsync({ lister_display_name: name.trim() || null, lister_logo_url: logoUrl })
            toastSuccess('Lister profile updated')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Update failed')
        }
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Store className="h-4 w-4 text-muted-foreground" /> List By — lister branding
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                    Shown as &quot;Listed by …&quot; on your Registered-tier Redeem catalog items.
                </p>
                <ImageUploadField value={logoUrl} onChange={setLogoUrl} label="Logo" />
                <div className="space-y-1.5">
                    <Label htmlFor="lister-name">Display name</Label>
                    <Input id="lister-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hexa Cat Studio" maxLength={60} />
                </div>
                <Button size="sm" disabled={!dirty || update.isPending} isLoading={update.isPending} loadingText="Saving…" onClick={save}>
                    Save
                </Button>
            </CardContent>
        </Card>
    )
}
