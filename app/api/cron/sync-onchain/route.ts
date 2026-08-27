import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/services/sync/poller'
import { supabaseAdmin } from '@/lib/supabase/server'


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

        // A target that couldn't reach the head within its time budget is either mis-configured (a
        // deploy block far below the real one) or fighting a failing RPC. Both are silent otherwise
        // — the app just serves stale data forever, which is exactly the failure that made freshly
        // created campaigns unsaveable. Recording it makes the admin System tab able to show it.
        const lagging = results.filter((result) => !result.caughtUp)
        if (lagging.length > 0) {
            await supabaseAdmin().from('audit_logs').insert({
                category: 'sync',
                action: 'sync.lagging',
                actor_wallet: null,
                actor_type: 'system',
                subject_type: null,
                subject_id: null,
                old_status: null,
                new_status: null,
                tx_hash: null,
                block_number: null,
                log_index: null,
                request_ip: null,
                user_agent: null,
                tg_update_id: null,
                metadata: { lagging },
            })
        }

        return NextResponse.json({ ok: true, results, lagging: lagging.map((r) => r.contract) })
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : 'sync failed' },
            { status: 500 }
        )
    }
}
