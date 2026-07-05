'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KycApplication, KycStatus } from '@/types/kyc'

// MOCK only — stand-in for the kyc_applications table + review API.
// Real flow: submission goes to backend (documents to private Storage bucket),
// admin reviews server-side, and the client only reads back the status.
interface MockKycState {
    applications: KycApplication[]
    submit: (app: KycApplication) => void
    review: (wallet: string, status: KycStatus, rejectReason?: string) => void
}

export const useMockKyc = create<MockKycState>()(
    persist(
        (set) => ({
            applications: [],
            submit: (app) =>
                set((s) => ({
                    applications: [
                        app,
                        ...s.applications.filter(
                            (a) => a.wallet.toLowerCase() !== app.wallet.toLowerCase()
                        ),
                    ],
                })),
            review: (wallet, status, rejectReason) =>
                set((s) => ({
                    applications: s.applications.map((a) =>
                        a.wallet.toLowerCase() === wallet.toLowerCase()
                            ? { ...a, status, rejectReason, reviewedAt: Date.now() }
                            : a
                    ),
                })),
        }),
        { name: 'mock-kyc' }
    )
)

export function useKycStatus(wallet?: string): KycStatus {
    const applications = useMockKyc((s) => s.applications)
    if (!wallet) return 'unverified'
    const app = applications.find((a) => a.wallet.toLowerCase() === wallet.toLowerCase())
    return app?.status ?? 'unverified'
}
