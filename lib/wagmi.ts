import { http, createConfig } from 'wagmi'
import { cookieStorage, createStorage } from 'wagmi'
import { bitkub } from 'wagmi/chains'
import type { Address } from 'viem'

export { bitkub }

export const kubTestnet = {
    id: 25925,
    name: 'KUB Testnet',
    nativeCurrency: { name: 'KUB', symbol: 'KUB', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc-testnet.bitkubchain.io'] },
    },
    blockExplorers: {
        default: { name: 'KUB Testnet Explorer', url: 'https://testnet.bkcscan.com' },
    },
    testnet: true,
} as const

export const supportedChains = [bitkub, kubTestnet] as const

const rpcUrls = {
    [bitkub.id]: 'https://rpc.bitkubchain.io',
    [kubTestnet.id]: 'https://rpc-testnet.bitkubchain.io',
}

export const wagmiConfig = createConfig({
    chains: supportedChains,
    transports: {
        // batch: coalesce nearby eth_calls into one JSON-RPC batch (fewer round-trips)
        [bitkub.id]: http(rpcUrls[bitkub.id], { batch: true }),
        [kubTestnet.id]: http(rpcUrls[kubTestnet.id], { batch: true }),
    },
    // Combine multiple reads (e.g. tokenURI for many NFTs) via Multicall3 = 1 RPC call
    // Multicall3 is already deployed at the canonical address on KUB
    batch: { multicall: true },
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
})

export const chainMetadata = {
    [bitkub.id]: {
        name: 'KUB Chain',
        symbol: 'KUB',
        icon: '/chains/kubchain.png',
        explorer: 'https://www.bkcscan.com',
    },
    [kubTestnet.id]: {
        name: 'KUB Testnet',
        symbol: 'KUB',
        icon: '/chains/kubchain.png',
        explorer: 'https://testnet.bkcscan.com',
    },
} as const

export function getChainMetadata(chainId: number) {
    return chainMetadata[chainId as keyof typeof chainMetadata]
}

/** Native tokens (ETH, KUB, …) are represented by the sentinel address 0xeee…eee. */
export function isNativeToken(address: Address): boolean {
    return address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
}

/**
 * Bitkub Chain must NOT unwrap wrapped native (KYC/regulatory) — it collects the
 * wrapped token (KKUB) instead of native KUB.
 */
const SKIP_UNWRAP_CHAINS = [bitkub.id] as const

export function shouldSkipUnwrap(chainId: number): boolean {
    return SKIP_UNWRAP_CHAINS.includes(chainId as (typeof SKIP_UNWRAP_CHAINS)[number])
}
