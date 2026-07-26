import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/services/sync/poller'

function isAuthorizedCron(request: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    if (!secret) return false
    return request.headers.get('authorization') === `Bearer ${secret}`
}

// Hit every 5 minutes by .github/workflows/cron-sync-onchain.yml. The only writer of
// nft_orders/rwa_orders status columns — see CLAUDE.md's Clean Workflow section.
export async function GET(request: NextRequest) {
    if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

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
