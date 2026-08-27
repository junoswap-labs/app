'use client'

import { use, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ImageUploadField } from '@/components/ui/image-upload'
import { useAirdropCampaign } from '@/hooks/useAirdropCampaigns'
import { useUpdateAirdropCampaign } from '@/hooks/useUpdateAirdropCampaign'
import { toastError, toastSuccess } from '@/lib/toast'
import type { AirdropVisibility } from '@/types/airdrop'

// Leaflet touches `window` at module load time, so it can only ever run client-side (same import
// shape as the create page).
const LocationPickerMap = dynamic(
    () => import('@/components/airdrop/location-picker-map').then((m) => m.LocationPickerMap),
    { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-md border bg-muted" /> }
)

export default function EditAirdropPage({ params }: { params: Promise<{ campaignId: string }> }) {
    const { campaignId } = use(params)
    const router = useRouter()
    const { address } = useAccount()
    const { data: campaign, isLoading } = useAirdropCampaign(campaignId)
    const update = useUpdateAirdropCampaign(campaignId)

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
    const [visibility, setVisibility] = useState<AirdropVisibility>('public')
    const [locationRestricted, setLocationRestricted] = useState(false)
    const [locationLat, setLocationLat] = useState<number | null>(null)
    const [locationLng, setLocationLng] = useState<number | null>(null)
    const [locationRadiusM, setLocationRadiusM] = useState('')
    const [ipDedupeEnabled, setIpDedupeEnabled] = useState(false)

    // Seed the form once the row arrives, keyed on id — re-seeding on every refetch would stomp
    // whatever the creator is mid-way through typing.
    useEffect(() => {
        if (!campaign) return
        setTitle(campaign.title ?? '')
        setDescription(campaign.description ?? '')
        setCoverImageUrl(campaign.cover_image_url ?? null)
        setVisibility(campaign.visibility)
        setLocationRestricted(campaign.location_restricted)
        setLocationLat(campaign.location_lat)
        setLocationLng(campaign.location_lng)
        setLocationRadiusM(campaign.location_radius_m != null ? String(campaign.location_radius_m) : '')
        setIpDedupeEnabled(campaign.ip_dedupe_enabled)
    }, [campaign?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    if (isLoading) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>
    if (!campaign) return <p className="p-8 text-sm text-muted-foreground">Campaign not found.</p>

    const isCreator = address != null && campaign.creator_wallet.toLowerCase() === address.toLowerCase()
    if (!isCreator) {
        return <p className="p-8 text-sm text-muted-foreground">Only the campaign creator can edit this airdrop.</p>
    }

    const geofenceIncomplete =
        locationRestricted && (locationLat == null || locationLng == null || !(Number(locationRadiusM) > 0))

    const save = async () => {
        try {
            await update.mutateAsync({
                title,
                description,
                cover_image_url: coverImageUrl,
                visibility,
                location_restricted: locationRestricted,
                location_lat: locationRestricted ? locationLat : null,
                location_lng: locationRestricted ? locationLng : null,
                location_radius_m: locationRestricted ? Number(locationRadiusM) : null,
                ip_dedupe_enabled: ipDedupeEnabled,
            })
            toastSuccess('Campaign updated')
            router.push('/app/airdrop/manage')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Could not save changes')
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon" aria-label="Back to My Airdrops">
                    <Link href="/app/airdrop/manage">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight">Edit airdrop</h1>
            </div>

            <p className="text-sm text-muted-foreground">
                Token, amounts, claimant cap, expiry, and who pays gas live on-chain and cannot be changed after
                creation. Everything below is off-chain and safe to edit at any time.
            </p>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <ImageUploadField value={coverImageUrl} onChange={setCoverImageUrl} label="Cover image" />
                    <div className="space-y-1.5">
                        <Label>Who can find this?</Label>
                        <RadioGroup
                            value={visibility}
                            onValueChange={(v) => setVisibility(v as AirdropVisibility)}
                            className="grid-cols-1 sm:grid-cols-2"
                        >
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="public" id="visibility-public" />
                                Public
                            </label>
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="unlisted" id="visibility-unlisted" />
                                QR code / link only
                            </label>
                        </RadioGroup>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Optional restrictions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="locationRestricted">Limit to a location</Label>
                            <Switch id="locationRestricted" checked={locationRestricted} onCheckedChange={setLocationRestricted} />
                        </div>
                        {locationRestricted && (
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">Click the map to set the center, or drag the pin.</p>
                                <LocationPickerMap
                                    lat={locationLat}
                                    lng={locationLng}
                                    radiusM={Number(locationRadiusM) || 0}
                                    onChange={(lat, lng) => {
                                        setLocationLat(lat)
                                        setLocationLng(lng)
                                    }}
                                />
                                <div className="space-y-1.5">
                                    <Label htmlFor="radius">Radius (meters)</Label>
                                    <Input
                                        id="radius"
                                        type="number"
                                        min="1"
                                        value={locationRadiusM}
                                        onChange={(e) => setLocationRadiusM(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="ipDedupe">Block repeat claims from the same network</Label>
                            <p className="text-xs text-muted-foreground">Rejects a second claim attempt from the same IP address.</p>
                        </div>
                        <Switch id="ipDedupe" checked={ipDedupeEnabled} onCheckedChange={setIpDedupeEnabled} />
                    </div>
                </CardContent>
            </Card>

            <Button
                size="lg"
                className="w-full"
                disabled={geofenceIncomplete || update.isPending}
                isLoading={update.isPending}
                loadingText="Saving…"
                onClick={save}
            >
                Save changes
            </Button>
        </div>
    )
}
