'use client'

import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CircleHelp } from 'lucide-react'

// Leaflet touches `window` at module load time, so it can only ever run client-side.
const LocationPickerMap = dynamic(() => import('@/components/airdrop/location-picker-map').then((m) => m.LocationPickerMap), {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-md border bg-muted" />,
})

export function StepRestrictions({
    locationRestricted,
    setLocationRestricted,
    locationLat,
    locationLng,
    setLocationLat,
    setLocationLng,
    locationRadiusM,
    setLocationRadiusM,
    captureLocation,
    ipDedupeEnabled,
    setIpDedupeEnabled,
}: {
    locationRestricted: boolean
    setLocationRestricted: (v: boolean) => void
    locationLat: number | null
    locationLng: number | null
    setLocationLat: (v: number) => void
    setLocationLng: (v: number) => void
    locationRadiusM: string
    setLocationRadiusM: (v: string) => void
    captureLocation: () => void
    ipDedupeEnabled: boolean
    setIpDedupeEnabled: (v: boolean) => void
}) {
    return (
        <>
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
                                <p className="text-xs text-muted-foreground">Click the map to set the center, or drag the pin. Use the button for your current location.</p>
                                <LocationPickerMap
                                    lat={locationLat}
                                    lng={locationLng}
                                    radiusM={Number(locationRadiusM) || 0}
                                    onChange={(lat, lng) => {
                                        setLocationLat(lat)
                                        setLocationLng(lng)
                                    }}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={captureLocation}>
                                    {locationLat != null ? 'Update my location' : 'Use my current location as center'}
                                </Button>
                                {locationLat != null && locationLng != null && (
                                    <p className="text-xs text-muted-foreground">
                                        Center: {locationLat.toFixed(5)}, {locationLng.toFixed(5)}
                                    </p>
                                )}
                                <div className="space-y-1.5">
                                    <Label htmlFor="radius">Radius (meters)</Label>
                                    <Input id="radius" type="number" min="1" value={locationRadiusM} onChange={(e) => setLocationRadiusM(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="ipDedupe">Block repeat claims from the same network</Label>
                            <p className="text-xs text-muted-foreground">
                                Rejects a second claim attempt from the same IP address.
                                {!locationRestricted && ' Recommended if claimers can enter an address without connecting a wallet.'}
                            </p>
                        </div>
                        <Switch id="ipDedupe" checked={ipDedupeEnabled} onCheckedChange={setIpDedupeEnabled} />
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                    <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Review your token address, total pool, and visibility before creating. Blockchain transactions cannot be undone.</p>
                </div>
            </div>
        </>
    )
}
