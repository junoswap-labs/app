import type { Address } from 'viem'

/**
 * Contract addresses are public on-chain data, not secrets — checked in here instead of scattered
 * across .env files. Keyed by chainId so testnet/mainnet can both be tracked; NEXT_PUBLIC_CHAIN_ID
 * still picks which network the app targets. Literal strings also sidestep the reason every other
 * NEXT_PUBLIC_* value has to live in env: Next.js inlines process.env.NEXT_PUBLIC_* by matching the
 * literal expression, so a computed env lookup is undefined in the browser — a plain object has no
 * such restriction.
 */
export interface ContractAddressBag {
    permissionRegistry?: Address
    junoPts?: Address
    airdropEscrow?: Address
    redeemNftSettlement?: Address
    redeemRwaEscrow?: Address
    rwaEscrow?: Address
    nftMarketplace?: Address
    airdropRelayer?: Address
    airdropSigner?: Address
    redeemOperator?: Address
    redeemOfficialTreasury?: Address
}

const ADDRESSES_BY_CHAIN: Record<number, ContractAddressBag> = {
    // kub-testnet (25925)
    25925: {
        permissionRegistry: '0xD8cB9517BB17C2974F30c1fF13fa4f1A2a869Ef5',
        junoPts: '0xb2b2eD5add2839C3ca421c389d92e9d48c590aEE',
        airdropEscrow: '0xD41B98bCe9d43e61bc2d99DF1ee7AB6536A56868',
        redeemNftSettlement: '0x3224388ae080f7a61c59ece3815bfeb2bb34ff87',
        redeemRwaEscrow: '0x2d3fc3413f0911707ae3a7ea673281d72fb4a442',
        rwaEscrow: '0x498cc6bf6165081b8a4febeb6bc72664e7c29b65',
        nftMarketplace: '0xe8c5e59cedbe409ec3c149e4f06d4925a562a8a7',
        airdropRelayer: '0x0306C0700cf9b84980B28501894937049Df765aA',
        airdropSigner: '0xD3B618C7969aF88a8fe00d51f3190a35e1B1fFBd',
        redeemOperator: '0xcEc26B71052Ddc390811cf76890BBe1B004F6717',
        redeemOfficialTreasury: '0xCA811301C650C92fD45ed32A81C0B757C61595b6',
    },
    // kub-mainnet (96) — fill in as contracts are deployed there
    96: {},
}

export function getContractAddresses(chainId: number): ContractAddressBag {
    return ADDRESSES_BY_CHAIN[chainId] ?? {}
}

/**
 * Server-side default (Route Handlers, the sync poller) — there's no connected wallet there, so
 * this falls back to the deployment's target chain. Client code should use useContractAddresses()
 * instead, which resolves off the wallet's actual connected chain via wagmi's useChainId().
 */
export const CONTRACT_ADDRESSES: ContractAddressBag = getContractAddresses(Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 96))
