import { describe, expect, it } from 'vitest'
import { haversineDistanceMeters, formatDistance } from './geo'

describe('haversineDistanceMeters', () => {
    it('is ~0 for the same point', () => {
        expect(haversineDistanceMeters(13.7563, 100.5018, 13.7563, 100.5018)).toBeLessThan(1)
    })

    it('matches a known distance (Bangkok CBD ~1.5km apart) within 2%', () => {
        const d = haversineDistanceMeters(13.7563, 100.5018, 13.7466, 100.5347)
        expect(d).toBeGreaterThan(3600)
        expect(d).toBeLessThan(3800)
    })
})

describe('formatDistance', () => {
    it('uses metres below 1km', () => {
        expect(formatDistance(420.4)).toBe('420 m')
    })
    it('uses km at/above 1km', () => {
        expect(formatDistance(1700)).toBe('1.7 km')
    })
})
