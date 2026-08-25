import type { ShippingInfo } from '@/types/redeem'

// Saved only when the buyer ticks the box — never automatic, and never synced to the server. A
// shipping address is personal data we have no reason to hold beyond the order it belongs to.
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
