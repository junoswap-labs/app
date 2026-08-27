import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side proxy for Nominatim (OpenStreetMap's free geocoder) — used by the location-picker
 * map's search box (components/airdrop/location-picker-map.tsx). Nominatim doesn't send
 * Access-Control-Allow-Origin, so a direct browser fetch silently fails CORS; routing through here
 * avoids that and lets us send a proper identifying User-Agent per Nominatim's usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/).
 */
export async function GET(request: NextRequest) {
    const q = request.nextUrl.searchParams.get('q')?.trim()
    if (!q || q.length < 3) return NextResponse.json([])

    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'JunoswapMarketplace/1.0 (airdrop location picker)' },
    })
    if (!res.ok) return NextResponse.json({ error: 'geocoding lookup failed' }, { status: 502 })

    const results = (await res.json()) as Array<{ place_id: number; display_name: string; lat: string; lon: string }>
    return NextResponse.json(results)
}
