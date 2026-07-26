import { NextRequest, NextResponse } from 'next/server'
import { rwaEscrowDeadlinesAbi } from '@/lib/abis/rwa-escrow'
import { serverPublicClient } from '@/lib/onchain/public-client'
import { supabaseAdmin } from '@/lib/supabase/server'
import { cachedFetch } from '@/lib/server-cache'

const WARNING_WINDOW_SECONDS = 24 * 60 * 60 // flag orders within 24h of their deadline

function isAuthorizedCron(request: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    if (!secret) return false
    return request.headers.get('authorization') === `Bearer ${secret}`
}

async function readDeadlines(rwaEscrowAddress: `0x${string}`) {
    return cachedFetch(
        `rwa-escrow-deadlines:${rwaEscrowAddress}`,
        async () => {
            const client = serverPublicClient()
            const [shipDeadline, autoReleaseDeadline] = await Promise.all([
                client.readContract({
                    address: rwaEscrowAddress,
                    abi: rwaEscrowDeadlinesAbi,
                    functionName: 'SHIP_DEADLINE',
                }),
                client.readContract({
                    address: rwaEscrowAddress,
                    abi: rwaEscrowDeadlinesAbi,
                    functionName: 'AUTO_RELEASE_DEADLINE',
                }),
            ])
            return { shipDeadline: Number(shipDeadline), autoReleaseDeadline: Number(autoReleaseDeadline) }
        },
        // Deadlines are immutable per deployment — safe to cache for a long time.
        6 * 60 * 60
    )
}

/**
 * Reader-only: reports RWA orders approaching their ship deadline (seller hasn't shipped) or
 * auto-release deadline (buyer hasn't confirmed receipt). Hit every 5 minutes by
 * .github/workflows/cron-sync-onchain.yml.
 *
 * Does NOT send any notification yet — this repo has no Telegram bot integration built (only
 * TELEGRAM_BOT_TOKEN in .env.example, no bot code anywhere). Returns the at-risk orders so a
 * notification channel can be wired in later without changing this query.
 */
export async function GET(request: NextRequest) {
    if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const rwaEscrowAddress = process.env.NEXT_PUBLIC_RWA_ESCROW_ADDRESS as `0x${string}` | undefined
    if (!rwaEscrowAddress) return NextResponse.json({ ok: true, results: { shipping: [], receiving: [] } })

    const { shipDeadline, autoReleaseDeadline } = await readDeadlines(rwaEscrowAddress)
    const now = Date.now()

    const [{ data: funded, error: fundedError }, { data: shipped, error: shippedError }] = await Promise.all([
        supabaseAdmin().from('rwa_orders').select('*').eq('status', 'Funded'),
        supabaseAdmin().from('rwa_orders').select('*').eq('status', 'Shipped'),
    ])
    if (fundedError) return NextResponse.json({ ok: false, error: fundedError.message }, { status: 500 })
    if (shippedError) return NextResponse.json({ ok: false, error: shippedError.message }, { status: 500 })

    const shipping = (funded ?? []).filter((o) => {
        const deadline = new Date(o.funded_at).getTime() + shipDeadline * 1000
        return deadline - now <= WARNING_WINDOW_SECONDS * 1000
    })
    const receiving = (shipped ?? []).filter((o) => {
        if (!o.shipped_at) return false
        const deadline = new Date(o.shipped_at).getTime() + autoReleaseDeadline * 1000
        return deadline - now <= WARNING_WINDOW_SECONDS * 1000
    })

    return NextResponse.json({ ok: true, results: { shipping, receiving } })
}
