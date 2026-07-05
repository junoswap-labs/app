import type { IndexerCreatorFee } from './types'

// Thin read client for the junoswap indexer's Fee-Creator endpoints (the deployed Ponder API,
// e.g. process.env.JUNOSWAP_INDEXER_URL). This repo never writes to junoswap — it only reads
// the per-creator fee attribution the indexer computes.

// Per-creator fee basis over an epoch. `fromDay`/`toDay` are UTC-day-aligned unix seconds
// bounding the epoch as [fromDay, toDay).
export async function fetchCreatorFees(
    baseUrl: string,
    params: { chainId: number; fromDay: number; toDay: number }
): Promise<IndexerCreatorFee[]> {
    const url = new URL('/campaign/creator-fees', baseUrl)
    url.searchParams.set('chainId', String(params.chainId))
    url.searchParams.set('fromDay', String(params.fromDay))
    url.searchParams.set('toDay', String(params.toDay))

    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) {
        throw new Error(`indexer /campaign/creator-fees failed: ${res.status}`)
    }
    const body = (await res.json()) as { creators?: IndexerCreatorFee[] }
    return body.creators ?? []
}
