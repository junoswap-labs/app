import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address } from 'viem'
import { bitkub, kubTestnet } from '@/lib/wagmi'
import { CONTRACT_ADDRESSES, DEFAULT_CHAIN_ID } from '@/config/contract-addresses'

// Server-side-only viem client (Route Handlers, sync poller) — reads chain state directly,
// independent of the browser's wagmi connection.
const chain = DEFAULT_CHAIN_ID === kubTestnet.id ? kubTestnet : bitkub
const rpcUrl = chain.rpcUrls.default.http[0]

let client: ReturnType<typeof createPublicClient> | null = null

export function serverPublicClient() {
    if (client) return client
    client = createPublicClient({ chain, transport: http(rpcUrl, { batch: true }) })
    return client
}

let operatorAccount: ReturnType<typeof privateKeyToAccount> | null = null

function redeemOperatorAccount() {
    if (operatorAccount) return operatorAccount
    const key = process.env.REDEEM_OPERATOR_PRIVATE_KEY
    if (!key) throw new Error('REDEEM_OPERATOR_PRIVATE_KEY is not configured')
    operatorAccount = privateKeyToAccount(key as `0x${string}`)
    return operatorAccount
}

let operatorClient: ReturnType<typeof createWalletClient<ReturnType<typeof http>, typeof chain, ReturnType<typeof privateKeyToAccount>>> | null = null

/**
 * Signs/broadcasts as the Redeem operator wallet — holds TOKEN_MANAGER_ROLE on the Redeem RwaEscrow
 * deployment only (see RwaEscrow.sol's header comment), so this is safe to use for auto-allowing a
 * payment token from a Route Handler without also handing that hot wallet pause/fee/arbitrator power.
 */
export function redeemOperatorWalletClient() {
    if (operatorClient) return operatorClient
    operatorClient = createWalletClient({ account: redeemOperatorAccount(), chain, transport: http(rpcUrl) })
    return operatorClient
}

export function permissionRegistryAddress(): Address {
    const addr = CONTRACT_ADDRESSES.permissionRegistry
    if (!addr) throw new Error('permissionRegistry address is not configured')
    return addr
}

export function junoPtsAddress(): Address {
    const addr = CONTRACT_ADDRESSES.junoPts
    if (!addr) throw new Error('junoPts address is not configured')
    return addr
}

export function redeemNftSettlementAddress(): Address {
    const addr = CONTRACT_ADDRESSES.redeemNftSettlement
    if (!addr) throw new Error('redeemNftSettlement address is not configured')
    return addr
}

export function redeemRwaEscrowAddress(): Address {
    const addr = CONTRACT_ADDRESSES.redeemRwaEscrow
    if (!addr) throw new Error('redeemRwaEscrow address is not configured')
    return addr
}
