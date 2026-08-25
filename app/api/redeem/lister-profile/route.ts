import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isPartnerRedeemOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'

/** "List By" branding for a Registered lister — custom display name + logo (uploaded via the same
 *  IPFS pipeline as item photos, see app/api/upload/image). Editable only by wallets holding the
 *  on-chain PARTNER_REDEEM_ROLE; readable by the owning wallet regardless (so the settings card can
 *  show "you're not a Redeem partner yet" state without the field itself being role-gated on read). */
export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const { data } = await supabaseAdmin()
        .from('users')
        .select('lister_display_name, lister_logo_url')
        .eq('wallet_address', wallet)
        .maybeSingle()

    return NextResponse.json({
        lister_display_name: data?.lister_display_name ?? null,
        lister_logo_url: data?.lister_logo_url ?? null,
    })
}

export async function PATCH(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
    if (!(await isPartnerRedeemOnChain(wallet as `0x${string}`))) {
        return NextResponse.json({ error: 'Redeem partner rights required — see /app/partner/apply' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const displayName = typeof body?.lister_display_name === 'string' ? body.lister_display_name.trim().slice(0, 60) : null
    const logoUrl = typeof body?.lister_logo_url === 'string' && body.lister_logo_url ? body.lister_logo_url : null

    const { data, error } = await supabaseAdmin()
        .from('users')
        .update({ lister_display_name: displayName || null, lister_logo_url: logoUrl })
        .eq('wallet_address', wallet)
        .select('lister_display_name, lister_logo_url')
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
}
