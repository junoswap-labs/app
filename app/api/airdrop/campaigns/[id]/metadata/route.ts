import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type CampaignUpdate = Database['public']['Tables']['airdrop_campaigns']['Update']

/**
 * Attaches the off-chain-only fields (title/description/cover image/GPS geofence/IP-dedupe
 * toggle) to a campaign the sync poller has already inserted from CampaignCreated — never writes
 * any on-chain-authoritative column (token/amounts/status/gas_mode/etc, gas_mode now travels in
 * the CampaignCreated event itself), so it can't race the poller. Requires the row to already
 * exist rather than upserting a partial one, since the table's on-chain-authoritative columns are
 * NOT NULL and only the poller knows their real values.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

    const { data: existing, error: fetchError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .select('creator_wallet')
        .eq('id', id)
        .maybeSingle()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!existing) {
        return NextResponse.json({ error: 'campaign not indexed yet — retry shortly' }, { status: 409 })
    }
    if (existing.creator_wallet.toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json({ error: "not this campaign's creator" }, { status: 403 })
    }

    const update: CampaignUpdate = {}
    if (typeof body.title === 'string') update.title = body.title.trim().slice(0, 200) || null
    if (typeof body.description === 'string') update.description = body.description.trim().slice(0, 2000) || null
    if (typeof body.cover_image_url === 'string' || body.cover_image_url === null) {
        update.cover_image_url = body.cover_image_url
    }
    if (body.visibility === 'public' || body.visibility === 'unlisted') update.visibility = body.visibility
    if (typeof body.token_symbol === 'string') update.token_symbol = body.token_symbol.trim().slice(0, 20) || null
    if (Number.isInteger(body.token_decimals) && body.token_decimals >= 0 && body.token_decimals <= 36) {
        update.token_decimals = body.token_decimals
    }
    if (typeof body.ip_dedupe_enabled === 'boolean') update.ip_dedupe_enabled = body.ip_dedupe_enabled
    if (typeof body.location_restricted === 'boolean') {
        update.location_restricted = body.location_restricted
        if (body.location_restricted) {
            const lat = Number(body.location_lat)
            const lng = Number(body.location_lng)
            const radius = Number(body.location_radius_m)
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
                return NextResponse.json(
                    { error: 'location_lat, location_lng, and location_radius_m are required when location_restricted is true' },
                    { status: 400 }
                )
            }
            update.location_lat = lat
            update.location_lng = lng
            update.location_radius_m = radius
        } else {
            update.location_lat = null
            update.location_lng = null
            update.location_radius_m = null
        }
    }

    const { data, error } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .update(update)
        .eq('id', id)
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
