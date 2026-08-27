import { supabaseAdmin } from '@/lib/supabase/server'

export async function getSyncState(chainId: number, contract: string): Promise<bigint | null> {
    const { data, error } = await supabaseAdmin()
        .from('sync_state')
        .select('last_block')
        .eq('chain_id', chainId)
        .eq('contract', contract)
        .maybeSingle()
    if (error) throw error
    return data ? BigInt(data.last_block) : null
}

export async function setSyncState(chainId: number, contract: string, lastBlock: bigint): Promise<void> {
    const { error } = await supabaseAdmin()
        .from('sync_state')
        .upsert(
            { chain_id: chainId, contract, last_block: lastBlock.toString(), updated_at: new Date().toISOString() },
            { onConflict: 'chain_id,contract' }
        )
    if (error) throw error
}
