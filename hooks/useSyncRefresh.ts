'use client'

import { useMutation } from '@tanstack/react-query'

/**
 * Nudges the sync poller right after a user's own writeContract confirms — step 2 of the Clean
 * Workflow in CLAUDE.md (writeContract → wait for receipt → useSyncRefresh() → invalidate +
 * re-fetch, poll 2-3x on lag). POST /api/sync/refresh runs the same incremental sync as the cron.
 */
export function useSyncRefresh() {
    return useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/sync/refresh', { method: 'POST' })
            if (!res.ok) throw new Error(`sync refresh failed: ${res.status}`)
            return res.json()
        },
    })
}
