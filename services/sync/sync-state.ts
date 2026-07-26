import { supabaseAdmin } from '@/lib/supabase/server'

export async function getSyncState(contract: string): Promise<bigint | null> {
    const { data, error } = await supabaseAdmin()
        .from('sync_state')
        .select('last_block')
        .eq('contract', contract)
        .maybeSingle()
    if (error) throw error
    return data ? BigInt(data.last_block) : null
}

export async function setSyncState(contract: string, lastBlock: bigint): Promise<void> {
    const { error } = await supabaseAdmin()
        .from('sync_state')
        .upsert(
            { contract, last_block: lastBlock.toString(), updated_at: new Date().toISOString() },
            { onConflict: 'contract' }
        )
    if (error) throw error
}
