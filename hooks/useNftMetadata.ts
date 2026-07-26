'use client'

import { useMemo } from 'react'
import { useReadContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { erc721Abi } from '@/lib/abis/erc721'
import { useCollectionConfig } from '@/hooks/useCollections'
import { readNftCache, writeNftCache } from '@/lib/nft-metadata-cache'
import { fetchNftMetadata, resolveNftImage } from '@/services/marketplace/nft-metadata'
import type { ResolvedNft } from '@/types/nft'

/**
 * Fetch NFT metadata the standard way: read `tokenURI` from the contract → fetch JSON → resolve image/name.
 * Collections registered in the `collections` table (hooks/useCollections.ts) are applied
 * automatically (gateway/display name/verified) — React Query's cache dedupes the collection
 * lookup across every card of the same collection, so this is cheap even in a large grid.
 */
export function useNftMetadata(contract: Address, tokenId: string | bigint, chainId?: number) {
    const id = BigInt(tokenId)
    const { data: config, isLoading: configLoading } = useCollectionConfig(contract)
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
        // Wait for the collection config to settle too, so a registered collection's
        // display name/verified badge/gateway is never missed by a query that ran first.
        enabled: (Boolean(cached) || Boolean(tokenUri)) && !configLoading,
        initialData: cached ?? undefined,
        // Token metadata almost never changes — staleTime Infinity prevents in-session refetch,
        // localStorage handles cross-session caching
        staleTime: Infinity,
        gcTime: 1000 * 60 * 30,
        queryFn: async (): Promise<ResolvedNft> => {
            const metadata = await fetchNftMetadata(tokenUri as string, config?.gateway ?? undefined)
            const resolved: ResolvedNft = {
                contract,
                tokenId: id.toString(),
                name: config?.display_name ?? metadata.name ?? `#${id.toString()}`,
                imageUrl: resolveNftImage(metadata, config?.gateway ?? undefined),
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
        isLoading: uriLoading || configLoading || metaQuery.isLoading,
        isError: uriError || metaQuery.isError,
    }
}
