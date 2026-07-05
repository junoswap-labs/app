import type { ResolvedNft } from '@/types/nft'

// Cache resolved metadata in localStorage — NFT metadata almost never changes,
// so caching across sessions cuts both RPC (tokenURI) and IPFS fetches on repeat views
const PREFIX = 'nft-meta:'
const VERSION = 'v1' // bump when the shape of ResolvedNft changes, to invalidate old cache

function key(contract: string, tokenId: string) {
    return `${PREFIX}${VERSION}:${contract.toLowerCase()}:${tokenId}`
}

export function readNftCache(contract: string, tokenId: string): ResolvedNft | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(key(contract, tokenId))
        return raw ? (JSON.parse(raw) as ResolvedNft) : null
    } catch {
        return null
    }
}

export function writeNftCache(contract: string, tokenId: string, value: ResolvedNft): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(key(contract, tokenId), JSON.stringify(value))
    } catch {
        // localStorage full/disabled — stay silent, not a critical path
    }
}
