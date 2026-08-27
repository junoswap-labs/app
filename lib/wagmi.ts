import { http, createConfig } from 'wagmi'
import { cookieStorage, createStorage } from 'wagmi'
import { walletConnect } from 'wagmi/connectors'
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
    // walletConnect's setup() eagerly boots @walletconnect/core, which touches indexedDB.
    // createConfig runs connector.setup() synchronously, and this module is imported by a
    // client component Next still renders on the server — so only hand it the connector in
    // the browser. The connect modal is client-only, so the server never needs it.
    connectors:
        typeof window === 'undefined'
            ? []
            : [
                  walletConnect({
                      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
                      showQrModal: true,
                  }),
              ],
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

type ChainMeta = {
    name: string
    symbol: string
    icon: string
    explorer: string
    // Some chain logos are dark glyphs that must be inverted on light backgrounds
    // (NetworkSwitcher checks this). KUB's icon is a colored logo, so it stays unset.
    invertInLight?: boolean
}

export const chainMetadata: Record<number, ChainMeta> = {
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
}

export function getChainMetadata(chainId: number): ChainMeta | undefined {
    return chainMetadata[chainId]
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
