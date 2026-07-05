// ERC721 metadata per the OpenSea/ERC721 Metadata JSON Schema (fields actually used + room for extras)
export interface NftMetadata {
    name?: string
    description?: string
    image?: string
    image_url?: string // some collections use this snake_case field instead of `image`
    animation_url?: string
    attributes?: NftAttribute[]
    [key: string]: unknown
}

export interface NftAttribute {
    trait_type?: string
    value?: string | number
}

/** Post-resolve result — ready to render on the card */
export interface ResolvedNft {
    contract: string
    tokenId: string
    name: string
    imageUrl: string | null
    description?: string
    attributes: NftAttribute[]
    verified: boolean
}
