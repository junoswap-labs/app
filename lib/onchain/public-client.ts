import { createPublicClient, http } from 'viem'
import type { Address } from 'viem'
import { bitkub, kubTestnet } from '@/lib/wagmi'

// Server-side-only viem client (Route Handlers, sync poller) — reads chain state directly,
// independent of the browser's wagmi connection. KUB_RPC_URL is server-only (see .env.example);
// falls back to the public RPC only if unset, matching the client-side default in lib/wagmi.ts.
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? bitkub.id)
const chain = chainId === kubTestnet.id ? kubTestnet : bitkub
const rpcUrl = process.env.KUB_RPC_URL || chain.rpcUrls.default.http[0]

let client: ReturnType<typeof createPublicClient> | null = null

export function serverPublicClient() {
    if (client) return client
    client = createPublicClient({ chain, transport: http(rpcUrl, { batch: true }) })
    return client
}

export function permissionRegistryAddress(): Address {
    const addr = process.env.NEXT_PUBLIC_PERMISSION_REGISTRY_ADDRESS
    if (!addr) throw new Error('NEXT_PUBLIC_PERMISSION_REGISTRY_ADDRESS is not set')
    return addr as Address
}

export function junoPtsAddress(): Address {
    const addr = process.env.NEXT_PUBLIC_JUNO_PTS_ADDRESS
    if (!addr) throw new Error('NEXT_PUBLIC_JUNO_PTS_ADDRESS is not set')
    return addr as Address
}

export function redeemNftSettlementAddress(): Address {
    const addr = process.env.NEXT_PUBLIC_REDEEM_NFT_SETTLEMENT_ADDRESS
    if (!addr) throw new Error('NEXT_PUBLIC_REDEEM_NFT_SETTLEMENT_ADDRESS is not set')
    return addr as Address
}

export function redeemRwaEscrowAddress(): Address {
    const addr = process.env.NEXT_PUBLIC_REDEEM_RWA_ESCROW_ADDRESS
    if (!addr) throw new Error('NEXT_PUBLIC_REDEEM_RWA_ESCROW_ADDRESS is not set')
    return addr as Address
}
