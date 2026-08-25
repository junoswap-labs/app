import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { serverPublicClient } from '@/lib/onchain/public-client'
import { getSyncTargets } from '@/lib/onchain/sync-contracts'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
    if (!(await isAdminOnChain(wallet as `0x${string}`))) {
        return NextResponse.json({ error: 'admin only' }, { status: 403 })
    }

    const head = await serverPublicClient().getBlockNumber()
    const { data: rows, error } = await supabaseAdmin().from('sync_state').select('contract, last_block')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const byContract = new Map((rows ?? []).map((row) => [row.contract, BigInt(row.last_block)]))
    const contracts = getSyncTargets().map((target) => {
        // No row yet means nothing has ever been synced for this contract, so it's behind by
        // everything since its deploy block — not "0 blocks behind".
        const lastBlock = byContract.get(target.contract) ?? target.deployBlock - 1n
        return {
            contract: target.contract,
            lastBlock: lastBlock.toString(),
            behind: (head - lastBlock).toString(),
        }
    })

    return NextResponse.json({ head: head.toString(), contracts })
}
