'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RedemptionOrder, RedemptionStatus } from '@/types/redeem'

// MOCK only — stand-in for the redemptions table + verification API until backend is ready.
// Real flow: status is written by the sync poller / admin endpoints, never by the client.
interface MockRedemptionState {
    orders: RedemptionOrder[]
    addOrder: (order: RedemptionOrder) => void
    setStatus: (id: string, status: RedemptionStatus, trackingNumber?: string) => void
}

export const useMockRedemptions = create<MockRedemptionState>()(
    persist(
        (set) => ({
            orders: [],
            addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
            setStatus: (id, status, trackingNumber) =>
                set((s) => ({
                    orders: s.orders.map((o) =>
                        o.id === id
                            ? {
                                  ...o,
                                  status,
                                  trackingNumber: trackingNumber ?? o.trackingNumber,
                                  updatedAt: Date.now(),
                              }
                            : o
                    ),
                })),
        }),
        { name: 'mock-redemptions' }
    )
)
