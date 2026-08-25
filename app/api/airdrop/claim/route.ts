import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'
import { airdropClaimDomain, AIRDROP_CLAIM_TYPES, type AirdropClaimAuthorization } from '@/lib/eip712'
import type { AirdropClaimAttemptOutcome } from '@/types/airdrop'
import { CONTRACT_ADDRESSES, DEFAULT_CHAIN_ID } from '@/config/contract-addresses'

const CAMPAIGN_ID_RE = /^0x[0-9a-fA-F]{64}$/
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const EARTH_RADIUS_M = 6371000

// Uniform-ish random bigint in [0, spanExclusive) — extra bytes over the span's own width keep the
// modulo bias negligible; the on-chain _computeRandomAmount() also uses a plain `% span`, so this
// doesn't need to be more rigorous than the contract path it's replacing.
function randomBigInt(spanExclusive: bigint): bigint {
    if (spanExclusive <= 0n) return 0n
    const byteLen = Math.ceil(spanExclusive.toString(16).length / 2) + 8
    const rand = BigInt('0x' + randomBytes(byteLen).toString('hex'))
    return rand % spanExclusive
}

// Mirrors AirdropEscrow.sol's _computeRandomAmount()/_validateRandomAmount() bounds and turnover
// rule exactly, but with real off-chain entropy instead of a predictable blockhash — see the
// contract header comment and the approved plan for why this had to move off-chain.
function computeSelfClaimAmount(campaign: {
    amount_mode: string
    fixed_amount: string | null
    min_amount: string | null
    max_amount: string | null
    remaining_amount: string
    max_claimants: number | null
    claimed_count: number
}): bigint {
    if (campaign.amount_mode === 'fixed') return BigInt(campaign.fixed_amount ?? '0')

    const remaining = BigInt(campaign.remaining_amount)
    const minAmount = BigInt(campaign.min_amount ?? '0')
    const maxAmount = BigInt(campaign.max_amount ?? '0')
    const maxClaimants = campaign.max_claimants ?? 0
    const forcedLastSlot = maxClaimants > 0 && campaign.claimed_count + 1 === maxClaimants
    const turnover = remaining < 2n * minAmount
    if (forcedLastSlot || turnover) return remaining

    const upperBound = maxAmount < remaining - minAmount ? maxAmount : remaining - minAmount
    const span = upperBound - minAmount + 1n
    return minAmount + randomBigInt(span)
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

async function recordAttempt(params: {
    campaignId: string
    sessionWallet: string
    recipientWallet: string
    clientIp: string | null
    outcome: AirdropClaimAttemptOutcome
}): Promise<void> {
    await supabaseAdmin().from('airdrop_claim_attempts').insert({
        campaign_id: params.campaignId,
        session_wallet: params.sessionWallet,
        recipient_wallet: params.recipientWallet,
        client_ip: params.clientIp,
        outcome: params.outcome,
    })
}

/**
 * The pre-claim gate — runs before ANY on-chain claim, in both gas-payment modes (see
 * hooks/useAirdropActions.ts's useClaimAirdrop). GPS/IP checks here are soft/UX-layer only: a
 * self-pay claimant who bypasses this endpoint and calls claim() directly on-chain cannot be
 * stopped by anything below, since the EVM has no notion of IP or location — see
 * contracts/src/AirdropEscrow.sol's header comment. Relayer-mode claims genuinely can't skip this
 * gate, since the relayer service only accepts requests from this route (shared secret).
 */
export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const campaignId: unknown = body?.campaignId
    const recipient: string = typeof body?.recipient === 'string' && ADDRESS_RE.test(body.recipient) ? body.recipient : wallet
    const gps = body?.gps as { lat?: unknown; lng?: unknown } | undefined

    if (typeof campaignId !== 'string' || !CAMPAIGN_ID_RE.test(campaignId)) {
        return NextResponse.json({ error: 'campaignId must be a bytes32 hex string' }, { status: 400 })
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

    const { data: campaign, error: campaignError } = await supabaseAdmin()
        .from('airdrop_campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle()
    if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 })
    if (!campaign) return NextResponse.json({ error: 'campaign not found' }, { status: 404 })

    if (
        campaign.status !== 'active' ||
        (campaign.expires_at && Date.now() > new Date(campaign.expires_at).getTime())
    ) {
        await recordAttempt({ campaignId, sessionWallet: wallet, recipientWallet: recipient, clientIp, outcome: 'rejected_campaign_inactive' })
        return NextResponse.json({ error: 'this campaign is no longer active' }, { status: 409 })
    }

    if (campaign.location_restricted) {
        const lat = typeof gps?.lat === 'number' ? gps.lat : null
        const lng = typeof gps?.lng === 'number' ? gps.lng : null
        if (lat == null || lng == null || campaign.location_lat == null || campaign.location_lng == null || campaign.location_radius_m == null) {
            await recordAttempt({ campaignId, sessionWallet: wallet, recipientWallet: recipient, clientIp, outcome: 'rejected_location' })
            return NextResponse.json({ error: 'location is required to claim this campaign' }, { status: 403 })
        }
        const distance = haversineDistanceMeters(lat, lng, campaign.location_lat, campaign.location_lng)
        if (distance > campaign.location_radius_m) {
            await recordAttempt({ campaignId, sessionWallet: wallet, recipientWallet: recipient, clientIp, outcome: 'rejected_location' })
            return NextResponse.json({ error: "you are outside this campaign's claim area" }, { status: 403 })
        }
    }

    if (campaign.ip_dedupe_enabled && clientIp) {
        const { data: priorIp, error: ipError } = await supabaseAdmin()
            .from('airdrop_claim_attempts')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('client_ip', clientIp)
            .eq('outcome', 'ok')
            .maybeSingle()
        if (ipError) return NextResponse.json({ error: ipError.message }, { status: 500 })
        if (priorIp) {
            await recordAttempt({ campaignId, sessionWallet: wallet, recipientWallet: recipient, clientIp, outcome: 'rejected_ip_dedupe' })
            return NextResponse.json({ error: 'a claim has already been made from this network' }, { status: 409 })
        }
    }

    const { data: priorWalletAttempt, error: walletError } = await supabaseAdmin()
        .from('airdrop_claim_attempts')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('session_wallet', wallet)
        .eq('outcome', 'ok')
        .maybeSingle()
    if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 })
    if (priorWalletAttempt) {
        await recordAttempt({ campaignId, sessionWallet: wallet, recipientWallet: recipient, clientIp, outcome: 'rejected_already_claimed' })
        return NextResponse.json({ error: 'you have already claimed this campaign' }, { status: 409 })
    }

    if (campaign.gas_mode === 'self') {
        const signerKey = process.env.AIRDROP_SIGNER_PRIVATE_KEY
        const escrowAddress = CONTRACT_ADDRESSES.airdropEscrow
        const chainId = DEFAULT_CHAIN_ID
        if (!signerKey || !escrowAddress) {
            return NextResponse.json({ error: 'the airdrop claim signer is not configured yet' }, { status: 500 })
        }

        const amount = computeSelfClaimAmount(campaign)
        const auth: AirdropClaimAuthorization = {
            campaignId: campaignId as `0x${string}`,
            recipient: recipient as `0x${string}`,
            amount,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 15 * 60), // 15 minutes to complete the on-chain tx
        }

        const account = privateKeyToAccount(signerKey as `0x${string}`)
        const signature = await account.signTypedData({
            domain: airdropClaimDomain(chainId, escrowAddress as `0x${string}`),
            types: AIRDROP_CLAIM_TYPES,
            primaryType: 'ClaimAuthorization',
            message: auth,
        })

        await recordAttempt({ campaignId, sessionWallet: wallet, recipientWallet: recipient, clientIp, outcome: 'ok' })
        return NextResponse.json({
            ok: true,
            mode: 'self',
            amount: amount.toString(),
            deadline: auth.deadline.toString(),
            signature,
        })
    }

    // Relayer mode — forward to the standalone relayer service (./server); everything above
    // already vetted this request, the relayer trusts this call via a shared secret alone.
    const relayerUrl = process.env.AIRDROP_RELAYER_SERVICE_URL
    const relayerSecret = process.env.AIRDROP_RELAYER_SERVICE_SECRET
    if (!relayerUrl || !relayerSecret) {
        return NextResponse.json({ error: 'the relayer service is not configured yet' }, { status: 500 })
    }

    try {
        const relayRes = await fetch(`${relayerUrl}/relay-claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-relayer-secret': relayerSecret },
            body: JSON.stringify({ campaignId, recipient }),
        })
        const relayBody = await relayRes.json().catch(() => null)
        if (!relayRes.ok) throw new Error(relayBody?.error ?? `relayer responded ${relayRes.status}`)

        await recordAttempt({ campaignId, sessionWallet: wallet, recipientWallet: recipient, clientIp, outcome: 'ok' })
        return NextResponse.json({ ok: true, mode: 'relayer', txHash: relayBody.txHash, status: relayBody.status })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'relay failed' }, { status: 502 })
    }
}
