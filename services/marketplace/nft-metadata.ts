import type { NftMetadata } from '@/types/nft'
import { resolveIpfs } from '@/lib/ipfs'
import { getCollectionConfig } from '@/lib/nft-collections'

/** Read metadata JSON from tokenURI (supports ipfs:// and data:application/json) */
export async function fetchNftMetadata(tokenUri: string, gateway?: string): Promise<NftMetadata> {
    // data URI: the JSON body is embedded in the URI itself, no network fetch needed
    if (tokenUri.startsWith('data:')) {
        const comma = tokenUri.indexOf(',')
        const meta = tokenUri.slice(comma + 1)
        const json = tokenUri.slice(0, comma).includes('base64') ? atob(meta) : decodeURIComponent(meta)
        return JSON.parse(json)
    }

    const res = await fetch(resolveIpfs(tokenUri, gateway))
    if (!res.ok) throw new Error(`metadata fetch failed: ${res.status}`)
    return res.json()
}

/**
 * Find the image URL in metadata and resolve it into a displayable URL.
 * Order: the collection's config.resolveImage (if any) → `image` → `image_url`
 */
export function resolveNftImage(
    metadata: NftMetadata,
    contract: string,
    tokenId: string
): string | null {
    const config = getCollectionConfig(contract)
    if (config?.resolveImage) return config.resolveImage(metadata, tokenId)

    const raw = metadata.image ?? metadata.image_url
    return raw ? resolveIpfs(raw, config?.gateway) : null
}
