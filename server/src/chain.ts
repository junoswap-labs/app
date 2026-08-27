import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address, Chain, PublicClient, WalletClient } from 'viem'

// Mirrors the main app's lib/onchain/public-client.ts + config/contract-addresses.ts model,
// duplicated here since this is a separate deployable with its own env — not a shared package.
// Only the two chains this whole product ever targets (see the main app's lib/wagmi.ts). Nothing
// here is bound to one chain: the relayer serves every chain it has an escrow address configured
// for, and /relay-claim picks the right one off the request's chainId.
const CHAINS: Record<number, Chain> = {
    96: {
        id: 96,
        name: 'Bitkub Chain',
        nativeCurrency: { name: 'KUB', symbol: 'KUB', decimals: 18 },
        rpcUrls: { default: { http: ['https://rpc.bitkubchain.io'] } },
    },
    25925: {
        id: 25925,
        name: 'KUB Testnet',
        nativeCurrency: { name: 'KUB', symbol: 'KUB', decimals: 18 },
        rpcUrls: { default: { http: ['https://rpc-testnet.bitkubchain.io'] } },
    },
}

export function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

// The relayer wallet — submits claimFor() on behalf of claimants in "creator pays gas" campaigns.
// Must hold RELAYER_ROLE on every deployed AirdropEscrow it serves (granted at deploy time, see
// contracts/script/DeployAirdropEscrow.s.sol). Unlike REDEEM_OPERATOR_PRIVATE_KEY in the main app
// (which only ever signs), this key actively sends transactions — that's the whole reason this is
// a standalone long-running process instead of a Next.js Route Handler (see queue.ts). The same
// EOA is used on every chain.
export const account = privateKeyToAccount(requireEnv('AIRDROP_RELAYER_PRIVATE_KEY') as `0x${string}`)

export interface ChainCtx {
    chainId: number
    publicClient: PublicClient
    walletClient: WalletClient
    escrowAddress: Address
}

// Per-chain escrow address / RPC: AIRDROP_ESCROW_ADDRESS_<chainId> + KUB_RPC_URL_<chainId>.
// The legacy single-chain vars (AIRDROP_ESCROW_ADDRESS / KUB_RPC_URL / CHAIN_ID) still work — they
// seed whichever chain CHAIN_ID names (default 96) so an existing single-chain deploy keeps running
// untouched.
function buildContexts(): Map<number, ChainCtx> {
    const legacyChainId = Number(process.env.CHAIN_ID ?? 96)
    const contexts = new Map<number, ChainCtx>()

    for (const chainId of Object.keys(CHAINS).map(Number)) {
        const escrowAddress =
            process.env[`AIRDROP_ESCROW_ADDRESS_${chainId}`] ||
            (chainId === legacyChainId ? process.env.AIRDROP_ESCROW_ADDRESS : undefined)
        if (!escrowAddress) continue

        const chain = CHAINS[chainId]
        const rpcUrl =
            process.env[`KUB_RPC_URL_${chainId}`] ||
            (chainId === legacyChainId ? process.env.KUB_RPC_URL : undefined) ||
            chain.rpcUrls.default.http[0]

        contexts.set(chainId, {
            chainId,
            publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
            walletClient: createWalletClient({ account, chain, transport: http(rpcUrl) }),
            escrowAddress: escrowAddress as Address,
        })
    }

    if (contexts.size === 0) {
        throw new Error('no AirdropEscrow address configured — set AIRDROP_ESCROW_ADDRESS_96 and/or AIRDROP_ESCROW_ADDRESS_25925')
    }
    return contexts
}

const contexts = buildContexts()

export const supportedChainIds = [...contexts.keys()]

export function getChainCtx(chainId: number): ChainCtx | undefined {
    return contexts.get(chainId)
}

// Mirrors lib/onchain/airdrop-gas.ts's CLAIM_FOR_GAS_UNITS in the main app — duplicated since this
// is a separate deployable with its own env, not a shared package. Keep both in sync if
// AirdropEscrow.claimFor()'s logic changes enough to move the real cost.
export const CLAIM_FOR_GAS_UNITS = 145_000n
