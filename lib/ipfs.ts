export const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

/**
 * Resolve an NFT URI into a fetchable/displayable URL.
 * - `ipfs://<cid>/path` and the duplicated form `ipfs://ipfs/<cid>` → `<gateway><cid>/path`
 * - `http(s)://` and `data:` are returned unchanged
 * The gateway is configurable per collection (see lib/nft-collections.ts) — some collections
 * are hosted on a dedicated gateway.
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
