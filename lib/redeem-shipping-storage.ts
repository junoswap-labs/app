import type { ShippingInfo } from '@/types/redeem'

// STEP 2.2 — "เลือกบันทึกบน local ได้": an explicit opt-in checkbox, not automatic, and never
// synced to the server — this is a per-device convenience only, same reasoning as the mock
// settings comment it replaces.
const STORAGE_KEY = 'redeem-saved-shipping'

export function getSavedShipping(): ShippingInfo | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as ShippingInfo) : null
    } catch {
        return null
    }
}

export function saveShipping(shipping: ShippingInfo): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shipping))
}

export function clearSavedShipping(): void {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(STORAGE_KEY)
}
