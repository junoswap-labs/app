'use client'

import { useState } from 'react'
import { MapPin, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LocationGateProps {
    onLocation: (lat: number, lng: number) => void
    radiusM: number
}

/** GPS permission UX for a geofenced campaign. Soft/UX-layer only — see
 *  contracts/src/AirdropEscrow.sol's header comment on why this can't be enforced on-chain. */
export function LocationGate({ onLocation, radiusM }: LocationGateProps) {
    const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'>('idle')

    const request = () => {
        if (!('geolocation' in navigator)) {
            setStatus('unsupported')
            return
        }
        setStatus('requesting')
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setStatus('granted')
                onLocation(pos.coords.latitude, pos.coords.longitude)
            },
            () => setStatus('denied'),
            { enableHighAccuracy: true, timeout: 10_000 }
        )
    }

    if (status === 'granted') {
        return (
            <p className="flex items-center gap-1.5 text-sm text-positive">
                <MapPin className="h-4 w-4" /> Location shared
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
