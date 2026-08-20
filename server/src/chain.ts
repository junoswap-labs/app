import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address } from 'viem'

// Mirrors the main app's lib/onchain/public-client.ts chain-selection logic, duplicated here
// since this is a separate deployable with its own env — not a shared package. Only the two
// chains this whole product ever targets (see the main app's lib/wagmi.ts).
const bitkub = {
    id: 96,
    name: 'Bitkub Chain',
    nativeCurrency: { name: 'KUB', symbol: 'KUB', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.bitkubchain.io'] } },
} as const

const kubTestnet = {
    id: 25925,
    name: 'KUB Testnet',
    nativeCurrency: { name: 'KUB', symbol: 'KUB', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc-testnet.bitkubchain.io'] } },
} as const

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

const chainId = Number(process.env.CHAIN_ID ?? bitkub.id)
const chain = chainId === kubTestnet.id ? kubTestnet : bitkub
const rpcUrl = process.env.KUB_RPC_URL || chain.rpcUrls.default.http[0]

// The relayer wallet — submits claimFor() on behalf of claimants in "creator pays gas" campaigns.
// Must hold RELAYER_ROLE on the deployed AirdropEscrow (granted at deploy time, see
// contracts/script/DeployAirdropEscrow.s.sol). Unlike REDEEM_OPERATOR_PRIVATE_KEY in the main app
// (which only ever signs), this key actively sends transactions — that's the whole reason this is
// a standalone long-running process instead of a Next.js Route Handler (see queue.ts).
export const account = privateKeyToAccount(requireEnv('AIRDROP_RELAYER_PRIVATE_KEY') as `0x${string}`)

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
export const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

export const airdropEscrowAddress = requireEnv('AIRDROP_ESCROW_ADDRESS') as Address

// Mirrors lib/onchain/airdrop-gas.ts's CLAIM_FOR_GAS_UNITS in the main app — duplicated since this
// is a separate deployable with its own env, not a shared package. Keep both in sync if
// AirdropEscrow.claimFor()'s logic changes enough to move the real cost.
export const CLAIM_FOR_GAS_UNITS = 145_000n
