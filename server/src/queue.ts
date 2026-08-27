import { account, getChainCtx } from './chain'

// Nonces are per-account-per-chain, so the submission queue is too: one tail per chain, each
// serialising only that chain's relays.
const tails = new Map<number, Promise<unknown>>()

/**
 * Sequential submission queue so concurrent /relay-claim requests for the same chain never race
 * for the same nonce. Each call waits for the previous one on that chain to finish being
 * *submitted* (not necessarily mined) before fetching a fresh 'pending' nonce and running its own
 * task — querying fresh state each time (rather than tracking a local counter) means a task that
 * fails before ever broadcasting doesn't leave a permanent nonce gap behind.
 *
 * This is a single-instance, in-process queue: nonce assignment is not coordinated across
 * processes, so never run more than one instance of this service against the same relayer wallet.
 */
export function enqueue<T>(chainId: number, task: (nonce: number) => Promise<T>): Promise<T> {
    const prev = tails.get(chainId) ?? Promise.resolve()
    const result = prev.then(async () => {
        const ctx = getChainCtx(chainId)
        if (!ctx) throw new Error(`no relayer context for chainId ${chainId}`)
        const nonce = await ctx.publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
        return task(nonce)
    })
    tails.set(
        chainId,
        result.catch(() => undefined) // one failure shouldn't wedge subsequent callers
    )
    return result
}
