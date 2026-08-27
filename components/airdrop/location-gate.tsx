'use client'

import { useState } from 'react'
import { MapPin, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { haversineDistanceMeters, formatDistance } from '@/lib/geo'

interface LocationGateProps {
    onLocation: (lat: number, lng: number) => void
    radiusM: number
    targetLat: number | null
    targetLng: number | null
}

/** GPS permission UX for a geofenced campaign. Soft/UX-layer only — see
 *  contracts/src/AirdropEscrow.sol's header comment on why this can't be enforced on-chain.
 *  The claim API re-checks the distance regardless; this just spares an obvious revert. */
export function LocationGate({ onLocation, radiusM, targetLat, targetLng }: LocationGateProps) {
    const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle')
    const [outOfRangeM, setOutOfRangeM] = useState<number | null>(null)

    const request = () => {
        if (!('geolocation' in navigator)) {
            setStatus('unsupported')
            return
        }
        setStatus('requesting')
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords
                if (targetLat != null && targetLng != null) {
                    const distance = haversineDistanceMeters(latitude, longitude, targetLat, targetLng)
                    if (distance > radiusM) {
                        setOutOfRangeM(distance)
                        setStatus('idle')
                        return
                    }
                }
                setOutOfRangeM(null)
                setStatus('granted')
                onLocation(latitude, longitude)
            },
            () => setStatus('denied'),
            { enableHighAccuracy: true, timeout: 10_000 }
        )
    }

    if (status === 'granted') {
        return (
            <p className="flex items-center gap-1.5 text-sm text-positive">
                <MapPin className="h-4 w-4" /> Location confirmed — you&apos;re in range
            </p>
        )
    }

    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="outline"
                onClick={request}
                disabled={status === 'requesting'}
                isLoading={status === 'requesting'}
                loadingText="Checking your location…"
                className="gap-1.5"
            >
                <MapPin className="h-4 w-4" />
                Share my location to claim
            </Button>
            <p className="text-xs text-muted-foreground">
                This campaign is limited to claimants within {radiusM}m of the creator&apos;s chosen spot.
            </p>
            {outOfRangeM != null && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> Out of location — you&apos;re {formatDistance(outOfRangeM)} from the claim
                    spot (must be within {radiusM}m).
                </p>
            )}
            {status === 'denied' && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> Location permission denied — enable it in your browser to claim.
                </p>
            )}
            {status === 'unsupported' && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> Your browser doesn&apos;t support location sharing.
                </p>
            )}
        </div>
    )
}
