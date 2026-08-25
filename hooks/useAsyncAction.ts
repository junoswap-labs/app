'use client'

import { useState } from 'react'
import { toastSuccess, toastError } from '@/lib/toast'

/**
 * Wraps a single "click a button, run an async mutation, toast the result" action with a
 * `pendingKey` so a list of buttons/rows can each independently show their own loading state
 * (`isPending(key)`) while every other one stays disabled — the same pattern the RWA detail page,
 * My Redemptions, and the fulfillment queue all need, extracted here instead of re-implementing
 * the try/catch/toast/pending-state trio per page.
 */
export function useAsyncAction<K extends string = string>() {
    const [pendingKey, setPendingKey] = useState<K | null>(null)

    const run = async (key: K, action: () => Promise<void>, successMessage?: string) => {
        setPendingKey(key)
        try {
            await action()
            if (successMessage) toastSuccess(successMessage)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Action failed')
        } finally {
            setPendingKey(null)
        }
    }

    return { run, pendingKey, isPending: (key: K) => pendingKey === key, anyPending: pendingKey !== null }
}
