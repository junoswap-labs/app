'use client'

import { useMemo } from 'react'
import { useReadContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { erc721Abi } from '@/lib/abis/erc721'
import { getCollectionConfig } from '@/lib/nft-collections'
import { readNftCache, writeNftCache } from '@/lib/nft-metadata-cache'
import { fetchNftMetadata, resolveNftImage } from '@/services/marketplace/nft-metadata'
import type { ResolvedNft } from '@/types/nft'

/**
 * Fetch NFT metadata the standard way: read `tokenURI` from the contract → fetch JSON → resolve image/name.
 * Collections with an entry in lib/nft-collections are overridden automatically (gateway/name/image/verified).
 */
export function useNftMetadata(contract: Address, tokenId: string | bigint, chainId?: number) {
    const id = BigInt(tokenId)
    const config = getCollectionConfig(contract)
    const cached = useMemo(() => readNftCache(contract, id.toString()), [contract, id])

    const {
        data: tokenUri,
        isLoading: uriLoading,
        isError: uriError,
    } = useReadContract({
        address: contract,
        abi: erc721Abi,
        functionName: 'tokenURI',
        args: [id],
        chainId,
        // Already in localStorage → skip the on-chain read entirely
        query: { enabled: !cached },
    })

    const metaQuery = useQuery({
        queryKey: ['nft-metadata', contract, id.toString()],
        enabled: Boolean(cached) || Boolean(tokenUri),
        initialData: cached ?? undefined,
        // Token metadata almost never changes — staleTime Infinity prevents in-session refetch,
        // localStorage handles cross-session caching
        staleTime: Infinity,
        gcTime: 1000 * 60 * 30,
        queryFn: async (): Promise<ResolvedNft> => {
            const metadata = await fetchNftMetadata(tokenUri as string, config?.gateway)
            const resolved: ResolvedNft = {
                contract,
                tokenId: id.toString(),
                name: config?.displayName ?? metadata.name ?? `#${id.toString()}`,
                imageUrl: resolveNftImage(metadata, contract, id.toString()),
                description: metadata.description,
                attributes: metadata.attributes ?? [],
                verified: config?.verified ?? false,
            }
            writeNftCache(contract, id.toString(), resolved)
            return resolved
        },
    })

    return {
        nft: metaQuery.data,
        isLoading: uriLoading || metaQuery.isLoading,
        isError: uriError || metaQuery.isError,
    }
}
