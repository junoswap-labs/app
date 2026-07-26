import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { runSync } from '@/services/sync/poller'

/**
 * Called by useSyncRefresh() right after a user's own writeContract confirms (see CLAUDE.md's
 * Clean Workflow) — nudges an immediate incremental sync instead of waiting for the ~5-minute
 * cron cadence. Runs the same general sync as /api/cron/sync-onchain; a true single-order
 * targeted lookup (skip the block-range scan, read that order's on-chain state directly) is a
 * future optimization, not implemented yet.
 */
export async function POST(request: NextRequest) {
    if (!getSessionWallet(request)) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    try {
        const results = await runSync()
        return NextResponse.json({ ok: true, results })
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : 'sync failed' },
            { status: 500 }
        )
    }
}
