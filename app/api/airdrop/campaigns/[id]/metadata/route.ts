import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'
import { serverPublicClient } from '@/lib/onchain/public-client'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { isAppHostedImageUrl } from '@/lib/image'
import { campaignShareHash } from '@/lib/onchain/airdrop-share'
import { airdropEscrowAbi } from '@/lib/abis/airdrop'
import type { Database } from '@/types/supabase'
import { getContractAddresses } from '@/config/contract-addresses'
import { parseChainId, InvalidChainError } from '@/lib/onchain/request-chain'

type CampaignUpdate = Database['public']['Tables']['airdrop_campaigns']['Update']

const CAMPAIGN_STATUS = ['active', 'closed', 'reclaimed'] as const

/**
 * The creator's title/description/cover image must not depend on the sync poller having caught up
 * — that's what used to make a fresh campaign's metadata unsaveable (409) while the poller ground
 * through its block backlog. So when the row isn't indexed yet, seed it here from getCampaign()
 * instead: every on-chain-authoritative column comes from the contract read, never from the
 * request body, so this doesn't become a client-writable status path. The poller's own upsert is
 * `ignoreDuplicates`, so it won't clobber the row afterwards — it only backfills tx_hash.
 */
async function seedFromChain(id: string, wallet: string, chainId: number) {
    const escrow = getContractAddresses(chainId).airdropEscrow
    if (!escrow) return { error: 'AirdropEscrow is not deployed yet', status: 500 as const }

    const campaign = await serverPublicClient(chainId).readContract({
        address: escrow,
        abi: airdropEscrowAbi,
        functionName: 'getCampaign',
        args: [id as `0x${string}`],
    })

    // A campaign that doesn't exist on-chain reads back as the zero struct.
    if (campaign.creator === '0x0000000000000000000000000000000000000000') {
        return { error: 'campaign not found on-chain yet — retry shortly', status: 409 as const }
    }
    if (campaign.creator.toLowerCase() !== wallet.toLowerCase()) {
        return { error: "not this campaign's creator", status: 403 as const }
    }

    const { error } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .upsert(
            {
                id,
                chain_id: chainId,
                creator_wallet: campaign.creator.toLowerCase(),
                token: campaign.token,
                amount_mode: campaign.amountMode === 0 ? 'fixed' : 'random',
                fixed_amount: campaign.fixedAmount > 0n ? campaign.fixedAmount.toString() : null,
                min_amount: campaign.minAmount > 0n ? campaign.minAmount.toString() : null,
                max_amount: campaign.maxAmount > 0n ? campaign.maxAmount.toString() : null,
                total_amount: campaign.totalAmount.toString(),
                remaining_amount: campaign.remainingAmount.toString(),
                max_claimants: campaign.maxClaimants,
                claimed_count: campaign.claimedCount,
                expires_at: campaign.expiresAt > 0n ? new Date(Number(campaign.expiresAt) * 1000).toISOString() : null,
                gas_mode: campaign.gasMode === 0 ? 'self' : 'relayer',
                gas_deposit: campaign.gasDeposit.toString(),
                share_hash: campaignShareHash(id as `0x${string}`),
                status: CAMPAIGN_STATUS[campaign.status] ?? 'active',
            },
            { onConflict: 'id', ignoreDuplicates: true }
        )
    if (error) return { error: error.message, status: 500 as const }
    return null
}

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

    let chainId: number
    try {
        chainId = parseChainId(request, body.chainId)
    } catch (err) {
        if (err instanceof InvalidChainError) return NextResponse.json({ error: err.message }, { status: 400 })
        throw err
    }

    const { data: existing, error: fetchError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .select('creator_wallet, title, description, cover_image_url, visibility')
        .eq('id', id)
        .eq('chain_id', chainId)
        .maybeSingle()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

    // Admins can overwrite any campaign's off-chain fields — this is the moderation path for a
    // campaign whose title/description/cover image turns out to be gambling, adult, or scam
    // content. It never touches an on-chain column, so a takedown can't move anyone's tokens.
    const isAdmin = await isAdminOnChain(wallet as `0x${string}`)

    if (!existing) {
        const failure = await seedFromChain(id, wallet, chainId)
        if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status })
    } else if (!isAdmin && existing.creator_wallet.toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json({ error: "not this campaign's creator" }, { status: 403 })
    }

    const previousValues = existing
        ? {
              title: existing.title,
              description: existing.description,
              cover_image_url: existing.cover_image_url,
              visibility: existing.visibility,
          }
        : null

    const update: CampaignUpdate = {}
    if (typeof body.title === 'string') update.title = body.title.trim().slice(0, 200) || null
    if (typeof body.description === 'string') update.description = body.description.trim().slice(0, 2000) || null
    if (body.cover_image_url === null) {
        update.cover_image_url = null
    } else if (typeof body.cover_image_url === 'string' && body.cover_image_url !== '') {
        if (!isAppHostedImageUrl(body.cover_image_url)) {
            return NextResponse.json(
                { error: 'cover image must be uploaded through this app — external image URLs are not accepted' },
                { status: 400 }
            )
        }
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
        .eq('chain_id', chainId)
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const editedSomeoneElses = isAdmin && existing != null && existing.creator_wallet.toLowerCase() !== wallet.toLowerCase()
    await supabaseAdmin()
        .from('audit_logs')
        .insert({
            category: editedSomeoneElses ? 'admin' : 'client',
            action: editedSomeoneElses ? 'airdrop.moderated' : 'airdrop.metadata_updated',
            actor_wallet: wallet,
            actor_type: editedSomeoneElses ? 'admin' : 'user',
            subject_type: 'airdrop_campaign',
            subject_id: id,
            chain_id: chainId,
            old_status: null,
            new_status: null,
            tx_hash: null,
            block_number: null,
            log_index: null,
            tg_update_id: null,
            request_ip: request.headers.get('x-forwarded-for'),
            user_agent: request.headers.get('user-agent'),
            // The previous values, so a moderation takedown is reversible and reviewable — the row
            // itself only keeps what it was replaced with.
            metadata: { changed: Object.keys(update), previous: previousValues },
        })

    return NextResponse.json(data)
}
