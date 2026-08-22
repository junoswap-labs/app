import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/server'

const REASONS = ['scam', 'adult', 'gambling', 'impersonation', 'other'] as const
const SUBJECT_TYPES = ['airdrop_campaign', 'redeem_item'] as const

export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'sign in to report content' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const subjectType = body?.subject_type
    const subjectId = body?.subject_id
    const reason = body?.reason
    if (!SUBJECT_TYPES.includes(subjectType) || typeof subjectId !== 'string' || !subjectId) {
        return NextResponse.json({ error: 'subject_type and subject_id are required' }, { status: 400 })
    }
    if (!REASONS.includes(reason)) return NextResponse.json({ error: 'unknown reason' }, { status: 400 })

    const { error } = await supabaseAdmin().from('content_reports').insert({
        reporter_wallet: wallet,
        subject_type: subjectType,
        subject_id: subjectId,
        reason,
        detail: typeof body.detail === 'string' ? body.detail.trim().slice(0, 1000) || null : null,
    })
    // 23505 = this wallet already has an open report on this subject (partial unique index).
    if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}
