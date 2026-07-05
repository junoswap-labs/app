import type { NftMetadata } from '@/types/nft'

/**
 * Per-collection config (overrides standard behavior).
 * The card's main path is standard ERC721 (read tokenURI → resolve IPFS) — this registry
 * only supplements collections that are non-standard or need special settings.
 * Adding a new contract = one entry here; no NftCard / hook changes needed.
 */
export interface NftCollectionConfig {
    /** custom IPFS gateway (in case the default gateway is slow or blocks this collection) */
    gateway?: string
    /** override the displayed name (e.g. use the official name instead of the metadata name) */
    displayName?: string
    /** ✓ badge marking the collection as verified */
    verified?: boolean
    /** custom image URL resolver for collections whose schema doesn't match standard ERC721 */
    resolveImage?: (metadata: NftMetadata, tokenId: string) => string | null
}

// key = contract address (lowercase). Most collections work through the standard path;
// add contracts that need special settings here, in one place.
const REGISTRY: Record<string, NftCollectionConfig> = {
    // Real example on KUB mainnet — CM Hexa Cat Meaw (KAP721)
    // metadata + images served via bitkubipfs.io (https, CORS enabled) so no gateway override needed
    '0x2f022d4ef37847304ecd167303aeaa9699f73663': {
        displayName: 'CM Hexa Cat Meaw',
        verified: true,
    },
}

export function getCollectionConfig(address: string): NftCollectionConfig | undefined {
    return REGISTRY[address.toLowerCase()]
}
