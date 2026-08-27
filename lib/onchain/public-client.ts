import { createPublicClient, createWalletClient, http } from 'viem'
import type { Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address } from 'viem'
import { supportedChains } from '@/lib/wagmi'
import { getContractAddresses } from '@/config/contract-addresses'

// Server-side-only viem clients (Route Handlers, sync poller) — read chain state directly,
// independent of the browser's wagmi connection. Everything here is chain-parameterised: nothing
// on the server is bound to a single chain, callers pass the chainId they resolved from the
// request (?chainId=) or from the poller's SUPPORTED_CHAIN_IDS sweep.

function chainFor(chainId: number): Chain {
    const chain = supportedChains.find((c) => c.id === chainId)
    if (!chain) throw new Error(`unsupported chainId: ${chainId}`)
    return chain
}

const publicClients = new Map<number, ReturnType<typeof createPublicClient>>()

export function serverPublicClient(chainId: number) {
    const cached = publicClients.get(chainId)
    if (cached) return cached
    const chain = chainFor(chainId)
    const client = createPublicClient({
        chain,
        transport: http(chain.rpcUrls.default.http[0], { batch: true }),
    })
    publicClients.set(chainId, client)
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

/**
 * Signs/broadcasts as the Redeem operator wallet — holds TOKEN_MANAGER_ROLE on the Redeem RwaEscrow
 * deployment only (see RwaEscrow.sol's header comment), so this is safe to use for auto-allowing a
 * payment token from a Route Handler without also handing that hot wallet pause/fee/arbitrator power.
 */
export function redeemOperatorWalletClient(chainId: number) {
    const chain = chainFor(chainId)
    return createWalletClient({
        account: redeemOperatorAccount(),
        chain,
        transport: http(chain.rpcUrls.default.http[0]),
    })
}

function requireAddress(chainId: number, key: keyof ReturnType<typeof getContractAddresses>, label: string): Address {
    const addr = getContractAddresses(chainId)[key]
    if (!addr) throw new Error(`${label} address is not configured for chainId ${chainId}`)
    return addr
}

export function permissionRegistryAddress(chainId: number): Address {
    return requireAddress(chainId, 'permissionRegistry', 'permissionRegistry')
}

export function junoPtsAddress(chainId: number): Address {
    return requireAddress(chainId, 'junoPts', 'junoPts')
}

export function redeemNftSettlementAddress(chainId: number): Address {
    return requireAddress(chainId, 'redeemNftSettlement', 'redeemNftSettlement')
}

export function redeemRwaEscrowAddress(chainId: number): Address {
    return requireAddress(chainId, 'redeemRwaEscrow', 'redeemRwaEscrow')
}
