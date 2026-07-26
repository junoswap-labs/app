import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { ApplicationKind, ApplicationStatus } from '@/types/applications'

async function requireAdmin(request: NextRequest): Promise<{ wallet: string } | { response: NextResponse }> {
    const wallet = getSessionWallet(request)
    if (!wallet) return { response: NextResponse.json({ error: 'not signed in' }, { status: 401 }) }
    if (!(await isAdminOnChain(wallet as `0x${string}`))) {
        return { response: NextResponse.json({ error: 'not an admin' }, { status: 403 }) }
    }
    return { wallet }
}

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const kind = request.nextUrl.searchParams.get('kind') as ApplicationKind | null
    const status = (request.nextUrl.searchParams.get('status') ?? 'pending') as ApplicationStatus

    let query = supabaseAdmin().from('applications').select('*').eq('status', status)
    if (kind) query = query.eq('kind', kind)

    const { data, error: dbError } = await query.order('submitted_at', { ascending: true })
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json(data)
}

/**
 * Marks an application reviewed — this is an AUDIT TRAIL update only. It does not grant any
 * permission by itself: the admin's wallet must separately call
 * PermissionRegistry.grantRole(wallet, ROLE) on-chain (see lib/abis/permission-registry.ts) —
 * that on-chain tx is what actually authorizes the applicant, before or after this call.
 */
export async function PATCH(request: NextRequest) {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response
    const { wallet } = auth

    const body = await request.json().catch(() => null)
    const { id, status, rejectReason } = body ?? {}
    if (!id || (status !== 'approved' && status !== 'rejected')) {
        return NextResponse.json({ error: 'id and status (approved|rejected) are required' }, { status: 400 })
    }

    const { data, error: dbError } = await supabaseAdmin()
        .from('applications')
        .update({
            status,
            reviewed_at: new Date().toISOString(),
            reviewed_by: wallet,
            reject_reason: status === 'rejected' ? (rejectReason ?? null) : null,
        })
        .eq('id', id)
        .select()
        .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json(data)
}
