/**
 * Guards the relayer wallet against having its gas drained by repeated /relay-claim calls for the
 * same claimant. AirdropEscrow.claimFor() reverts on a double claim, but a reverted tx still burns
 * the relayer's gas — so a caller holding the shared secret could empty the hot wallet by replaying
 * one request. Blocking the duplicate before it ever reaches writeContract is the only thing that
 * actually stops that.
 *
 * ponytail: in-process Map, same single-instance assumption queue.ts already requires (nonce
 * management can't be shared either). Move to Redis only if the relayer ever needs >1 replica.
 */
const RETRY_AFTER_MS = 60_000

type State = { done: boolean; at: number }

const seen = new Map<string, State>()

function key(chainId: number, campaignId: string, recipient: string) {
    return `${chainId}:${campaignId.toLowerCase()}:${recipient.toLowerCase()}`
}

/** Returns null when the caller may proceed, or the reason to reject with. */
export function claim(chainId: number, campaignId: string, recipient: string, now = Date.now()): 'already-relayed' | 'in-flight' | null {
    const k = key(chainId, campaignId, recipient)
    const prev = seen.get(k)
    if (prev?.done) return 'already-relayed'
    // An in-flight entry that's older than the window is treated as abandoned (process-level crash
    // between mark and release), so one stuck request can't permanently lock out a claimant.
    if (prev && now - prev.at < RETRY_AFTER_MS) return 'in-flight'
    seen.set(k, { done: false, at: now })
    return null
}

/** Call after the relay settles: a confirmed claim is blocked forever, a failure is retryable. */
export function settle(chainId: number, campaignId: string, recipient: string, confirmed: boolean, now = Date.now()) {
    const k = key(chainId, campaignId, recipient)
    if (confirmed) seen.set(k, { done: true, at: now })
    else seen.delete(k)
}
