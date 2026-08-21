import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

const SHARE_HASH_RE = /^[0-9a-f]{16}$/

/** Resolves a shared QR/link token (see lib/onchain/airdrop-share.ts) back to its campaign — the
 *  public entry point for app/app/airdrop/s/[shareHash]/page.tsx. Works for any campaign
 *  regardless of visibility: hiding a campaign from the Browse page doesn't mean the link/QR
 *  itself should stop working, that's the whole point of "unlisted". */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ shareHash: string }> }) {
    const { shareHash } = await params
    if (!SHARE_HASH_RE.test(shareHash)) {
        return NextResponse.json({ error: 'invalid share link' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin().from('airdrop_campaigns').select('*').eq('share_hash', shareHash).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    return NextResponse.json(data)
}
