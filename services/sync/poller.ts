import { serverPublicClient } from '@/lib/onchain/public-client'
import { getSyncTargets } from '@/lib/onchain/sync-contracts'
import { getSyncState, setSyncState } from '@/services/sync/sync-state'

// Chunk size per getLogs call — bounds how much a single run scans even after a long gap
// (deploy, downtime), independent of whatever range cap the RPC provider enforces.
const MAX_BLOCK_RANGE = 5_000n

// Wall-clock budget for one runSync() call — a contract far behind the head needs many chunks, and
// the route this runs under (POST /api/sync/refresh) has a request timeout. Whatever isn't reached
// this pass resumes from sync_state on the next one.
const RUN_TIME_BUDGET_MS = 20_000

export interface SyncResult {
    contract: string
    fromBlock: string
    toBlock: string
    eventsSeen: number
    /** false when the time budget ran out before reaching the head — call again to continue. */
    caughtUp: boolean
}

/** Runs one incremental sync pass over every deployed contract in lib/onchain/sync-contracts.ts. */
export async function runSync(): Promise<SyncResult[]> {
    const client = serverPublicClient()
    const latestBlock = await client.getBlockNumber()
    const results: SyncResult[] = []

    // Split the budget per target so one contract far behind the head can't starve the others of
    // their catch-up time (targets are always processed in the same order).
    const targets = getSyncTargets()
    const perTargetBudgetMs = RUN_TIME_BUDGET_MS / Math.max(targets.length, 1)

    for (const target of targets) {
        const lastProcessed = await getSyncState(target.contract)
        const fromBlock = lastProcessed !== null ? lastProcessed + 1n : target.deployBlock

        if (fromBlock > latestBlock) {
            results.push({
                contract: target.contract,
                fromBlock: fromBlock.toString(),
                toBlock: fromBlock.toString(),
                eventsSeen: 0,
                caughtUp: true,
            })
            continue
        }

        // Keep chunking until caught up, instead of advancing one MAX_BLOCK_RANGE window per call.
        // With a single window a contract whose deploy block is far behind the head (or one that
        // fell behind during downtime) could never catch up: every /api/sync/refresh moved the
        // cursor 5k blocks while the chain produced more, so a just-created campaign stayed
        // unindexed and its metadata PATCH kept 409-ing.
        let cursor = fromBlock
        let eventsSeen = 0
        let lastProcessedBlock = fromBlock - 1n
        const deadline = Date.now() + perTargetBudgetMs

        while (cursor <= latestBlock && Date.now() < deadline) {
            const toBlock = cursor + MAX_BLOCK_RANGE < latestBlock ? cursor + MAX_BLOCK_RANGE : latestBlock

            const logs = await client.getLogs({
                address: target.address,
                events: target.abi,
                fromBlock: cursor,
                toBlock,
            })

            for (const log of logs) {
                const handler = target.handlers[log.eventName as string]
                // Every event in target.abi has a handler registered in target.handlers — this only
                // stays undefined if a new event is added to the ABI slice without a matching
                // handler, which is a bug to surface loudly, not swallow.
                if (!handler) throw new Error(`no sync handler registered for ${target.contract}.${log.eventName}`)
                await handler(log as Parameters<typeof handler>[0])
            }

            // Persisted per chunk, not once at the end: a timeout or crash mid-catch-up then
            // resumes from the last fully-handled window rather than replaying from the start.
            await setSyncState(target.contract, toBlock)
            eventsSeen += logs.length
            lastProcessedBlock = toBlock
            cursor = toBlock + 1n
        }

        results.push({
            contract: target.contract,
            fromBlock: fromBlock.toString(),
            toBlock: lastProcessedBlock.toString(),
            eventsSeen,
            caughtUp: cursor > latestBlock,
        })
    }

    return results
}
