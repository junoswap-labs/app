// Pinata's own gateway serves anything we've pinned immediately; ipfs.io 403s on fresh CIDs
// that haven't propagated to it yet (and rate-limits hard behind Cloudflare).
export const DEFAULT_IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'

/**
 * Resolve an NFT URI into a fetchable/displayable URL.
 * - `ipfs://<cid>/path` and the duplicated form `ipfs://ipfs/<cid>` → `<gateway><cid>/path`
 * - `http(s)://` and `data:` are returned unchanged
 * The gateway is configurable per collection (see the `collections` table / types/collection.ts)
 * — some collections are hosted on a dedicated gateway.
 */
export function resolveIpfs(uri: string, gateway: string = DEFAULT_IPFS_GATEWAY): string {
    if (!uri) return uri
    if (uri.startsWith('ipfs://')) {
        let path = uri.slice('ipfs://'.length)
        if (path.startsWith('ipfs/')) path = path.slice('ipfs/'.length)
        return gateway + path
    }
    return uri
}
