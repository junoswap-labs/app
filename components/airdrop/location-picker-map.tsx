'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Input } from '@/components/ui/input'

// Next.js/webpack doesn't resolve Leaflet's default marker image paths correctly — pulling them
// from a CDN sidesteps that entirely instead of fighting the bundler over static asset URLs.
const markerIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
})

const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018] // Bangkok

interface NominatimResult {
    place_id: number
    display_name: string
    lat: string
    lon: string
}

function ClickToSetPosition({ onPick }: { onPick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onPick(e.latlng.lat, e.latlng.lng)
        },
    })
    return null
}

// react-leaflet only applies MapContainer's `center` prop on first mount — this re-flies the view
// whenever the picked point changes from outside the map itself (search result, GPS button).
function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap()
    useEffect(() => {
        map.setView([lat, lng], Math.max(map.getZoom(), 15))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lat, lng])
    return null
}

// Free-text place/address search via Nominatim (OpenStreetMap's geocoder), proxied through
// /api/geocode since Nominatim doesn't allow direct cross-origin browser requests (no
// Access-Control-Allow-Origin header — see that route for details). No API key, matches the rest
// of the map being free/keyless. Debounced and request-cancelled per keystroke to stay polite.
function LocationSearchBox({ onSelect }: { onSelect: (lat: number, lng: number, label: string) => void }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<NominatimResult[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (query.trim().length < 3) {
            setResults([])
            return
        }
        const controller = new AbortController()
        const timer = setTimeout(() => {
            setLoading(true)
            fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal: controller.signal })
                .then((res) => res.json())
                .then((data: NominatimResult[]) => {
                    setResults(data)
                    setOpen(true)
                })
                .catch(() => {
                    // aborted (next keystroke) or network hiccup — nothing to show for this attempt
                })
                .finally(() => setLoading(false))
        }, 500)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query])

    return (
        <div className="relative">
            <Input
                placeholder="Search for a place or address…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {loading && <p className="mt-1 text-xs text-muted-foreground">Searching…</p>}
            {open && results.length > 0 && (
                <div className="absolute z-[1000] mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                    {results.map((r) => (
                        <button
                            key={r.place_id}
                            type="button"
                            className="block w-full truncate px-3 py-2 text-left text-xs hover:bg-muted"
                            onClick={() => {
                                onSelect(Number(r.lat), Number(r.lon), r.display_name)
                                setQuery(r.display_name)
                                setOpen(false)
                            }}
                        >
                            {r.display_name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export function LocationPickerMap({
    lat,
    lng,
    radiusM,
    onChange,
}: {
    lat: number | null
    lng: number | null
    radiusM: number
    onChange: (lat: number, lng: number) => void
}) {
    const center = useMemo<[number, number]>(() => (lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER), [lat, lng])

    return (
        <div className="space-y-2">
            <LocationSearchBox onSelect={(lat, lng) => onChange(lat, lng)} />
            {/* `isolate` traps Leaflet's internal z-index (panes 400, controls 800+) inside this
                stacking context so they can't paint over a z-50 modal opened above the map. */}
            <div className="isolate h-64 w-full overflow-hidden rounded-md border">
                <MapContainer center={center} zoom={lat != null ? 15 : 6} scrollWheelZoom className="h-full w-full">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ClickToSetPosition onPick={onChange} />
                    {lat != null && lng != null && (
                        <>
                            <RecenterOnChange lat={lat} lng={lng} />
                            <Marker
                                position={[lat, lng]}
                                icon={markerIcon}
                                draggable
                                eventHandlers={{
                                    dragend: (e) => {
                                        const pos = e.target.getLatLng()
                                        onChange(pos.lat, pos.lng)
                                    },
                                }}
                            />
                            <Circle center={[lat, lng]} radius={radiusM} pathOptions={{ color: '#ff914d', fillOpacity: 0.1 }} />
                        </>
                    )}
                </MapContainer>
            </div>
        </div>
    )
}
