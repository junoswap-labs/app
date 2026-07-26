// Server-side in-memory cache for API routes — dedupes concurrent requests for the same key
// and avoids re-hitting RPC/IPFS/Pinata within the TTL window. Process-local (no cross-instance
// sharing), which is fine here: it's an optimization, not a correctness requirement.

interface CacheEntry<T> {
    data: T
    expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

setInterval(
    () => {
        const now = Date.now()
        for (const [key, entry] of store) {
            if (now > entry.expiresAt) store.delete(key)
        }
    },
    5 * 60 * 1000
)

export function getCached<T>(key: string): T | null {
    const entry = store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
        store.delete(key)
        return null
    }
    return entry.data as T
}

export function setCached<T>(key: string, data: T, ttlSeconds: number): void {
    store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
}

const inflight = new Map<string, Promise<unknown>>()

/** Cache + in-flight dedup: concurrent callers for the same key share one fetcher call. */
export async function cachedFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number
): Promise<T> {
    const cached = getCached<T>(key)
    if (cached !== null) return cached

    const existing = inflight.get(key)
    if (existing) return existing as Promise<T>

    const promise = fetcher()
        .then((data) => {
            setCached(key, data, ttlSeconds)
            inflight.delete(key)
            return data
        })
        .catch((err) => {
            inflight.delete(key)
            throw err
        })

    inflight.set(key, promise)
    return promise
}
