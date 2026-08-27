import { NextRequest, NextResponse } from 'next/server'
import { getSessionWallet } from '@/lib/auth/session'
import { isAdminOnChain } from '@/lib/onchain/roles'
import { serverPublicClient } from '@/lib/onchain/public-client'
import { getSyncTargets } from '@/lib/onchain/sync-contracts'
import { SUPPORTED_CHAIN_IDS } from '@/config/contract-addresses'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
    if (!(await isAdminOnChain(wallet as `0x${string}`))) {
        return NextResponse.json({ error: 'admin only' }, { status: 403 })
    }

    const { data: rows, error } = await supabaseAdmin().from('sync_state').select('chain_id, contract, last_block')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const byKey = new Map((rows ?? []).map((row) => [`${row.chain_id}:${row.contract}`, BigInt(row.last_block)]))

    const chains = await Promise.all(
        SUPPORTED_CHAIN_IDS.map(async (chainId) => {
            const head = await serverPublicClient(chainId).getBlockNumber()
            const contracts = getSyncTargets(chainId).map((target) => {
                // No row yet means nothing has ever been synced for this contract, so it's behind by
                // everything since its deploy block — not "0 blocks behind".
                const lastBlock = byKey.get(`${chainId}:${target.contract}`) ?? target.deployBlock - 1n
                return {
                    contract: target.contract,
                    lastBlock: lastBlock.toString(),
                    behind: (head - lastBlock).toString(),
                }
            })
            return { chainId, head: head.toString(), contracts }
        })
    )

    return NextResponse.json({ chains })
}
