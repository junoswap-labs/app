const EARTH_RADIUS_M = 6371000

/** Great-circle distance in metres. Used by the airdrop geofence — the API route
 *  (app/api/airdrop/claim) enforces it, the LocationGate mirrors it for UX. */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/** "420 m" under 1 km, "1.7 km" above. */
export function formatDistance(meters: number): string {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}
