'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// MOCK only — stand-in for the users row (google/telegram links + notification prefs).
// Real flow: Google via Supabase OAuth + /api/auth/link-google; Telegram via
// /api/telegram/start-link deep-link and webhook pairing; toggles PATCH the own row (RLS).
interface MockSettingsState {
    googleEmail: string | null
    telegramLinked: boolean
    notifyNewOffer: boolean
    notifyDeadline: boolean
    setGoogleEmail: (email: string | null) => void
    setTelegramLinked: (linked: boolean) => void
    setNotify: (key: 'notifyNewOffer' | 'notifyDeadline', value: boolean) => void
}

export const useMockSettings = create<MockSettingsState>()(
    persist(
        (set) => ({
            googleEmail: null,
            telegramLinked: false,
            notifyNewOffer: true,
            notifyDeadline: true,
            setGoogleEmail: (googleEmail) => set({ googleEmail }),
            setTelegramLinked: (telegramLinked) => set({ telegramLinked }),
            setNotify: (key, value) => set({ [key]: value }),
        }),
        { name: 'mock-settings' }
    )
)
