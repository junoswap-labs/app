import { serverPublicClient } from '@/lib/onchain/public-client'
import { getSyncTargets } from '@/lib/onchain/sync-contracts'
import { getSyncState, setSyncState } from '@/services/sync/sync-state'
import { eventHandlers } from '@/services/sync/handlers'

// Chunk size per getLogs call — bounds how much a single run scans even after a long gap
// (deploy, downtime), independent of whatever range cap the RPC provider enforces.
const MAX_BLOCK_RANGE = 5_000n

export interface SyncResult {
    contract: string
    fromBlock: string
    toBlock: string
    eventsSeen: number
}

/** Runs one incremental sync pass over every deployed contract in lib/onchain/sync-contracts.ts. */
export async function runSync(): Promise<SyncResult[]> {
    const client = serverPublicClient()
    const latestBlock = await client.getBlockNumber()
    const results: SyncResult[] = []

    for (const target of getSyncTargets()) {
        const lastProcessed = await getSyncState(target.contract)
        const fromBlock = lastProcessed !== null ? lastProcessed + 1n : target.deployBlock

        if (fromBlock > latestBlock) {
            results.push({ contract: target.contract, fromBlock: fromBlock.toString(), toBlock: fromBlock.toString(), eventsSeen: 0 })
            continue
        }

        const toBlock = fromBlock + MAX_BLOCK_RANGE < latestBlock ? fromBlock + MAX_BLOCK_RANGE : latestBlock

        const logs = await client.getLogs({
            address: target.address,
            events: target.abi,
            fromBlock,
            toBlock,
        })

        for (const log of logs) {
            const handler = eventHandlers[log.eventName as string]
            // Every event in target.abi has a handler registered — this only stays undefined if a
            // new event is added to the ABI slice without a matching handler, which is a bug to
            // surface loudly, not swallow.
            if (!handler) throw new Error(`no sync handler registered for event ${log.eventName}`)
            await handler(log as Parameters<typeof handler>[0])
        }

        await setSyncState(target.contract, toBlock)
        results.push({ contract: target.contract, fromBlock: fromBlock.toString(), toBlock: toBlock.toString(), eventsSeen: logs.length })
    }

    return results
}
