import { account, publicClient } from './chain'

let tail: Promise<unknown> = Promise.resolve()

/**
 * Sequential submission queue so concurrent /relay-claim requests never race for the same nonce.
 * Each call waits for the previous one to finish being *submitted* (not necessarily mined) before
 * fetching a fresh 'pending' nonce and running its own task — querying fresh state each time
 * (rather than tracking a local counter) means a task that fails before ever broadcasting doesn't
 * leave a permanent nonce gap behind.
 *
 * This is a single-instance, in-process queue: nonce assignment is not coordinated across
 * processes, so never run more than one instance of this service against the same relayer wallet.
 */
export function enqueue<T>(task: (nonce: number) => Promise<T>): Promise<T> {
    const result = tail.then(async () => {
        const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' })
        return task(nonce)
    })
    tail = result.catch(() => undefined) // one failure shouldn't wedge subsequent callers
    return result
}
