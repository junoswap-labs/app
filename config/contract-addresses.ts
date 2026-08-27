import type { Address } from 'viem'

// Public on-chain data, not secrets — checked in here instead of .env, keyed by chainId.
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
        redeemRwaEscrow: '0x8Ca069Cf6b71aCfb22c31473a7912561d897B857',
        rwaEscrow: '0x498cc6bf6165081b8a4febeb6bc72664e7c29b65',
        nftMarketplace: '0xe8c5e59cedbe409ec3c149e4f06d4925a562a8a7',
        airdropRelayer: '0x0306C0700cf9b84980B28501894937049Df765aA',
        airdropSigner: '0xD3B618C7969aF88a8fe00d51f3190a35e1B1fFBd',
        redeemOperator: '0xcEc26B71052Ddc390811cf76890BBe1B004F6717',
        redeemOfficialTreasury: '0xCA811301C650C92fD45ed32A81C0B757C61595b6',
    },
    // kub-mainnet (96) — fill in as contracts are deployed there
    96: {
        permissionRegistry: '0x2fB4D4E75A756FECBC32c356EA9139b1FbC35D15',
        junoPts: '0xD7d24786E8009259811683E37761e886d9E28894',
        airdropEscrow: '0x8dAbACD4Da790A5b22F51Bd3433123B6578B68eB',
    },
}

export const DEFAULT_CHAIN_ID = 25925

// Sync poller's first block to scan per contract when sync_state has no row yet. Update alongside
// the matching address above when redeploying — kept in the same file so the two can't drift.
export const DEPLOY_BLOCKS: Partial<Record<keyof ContractAddressBag, bigint>> = {
    nftMarketplace: 32881939n,
    rwaEscrow: 32881946n,
    redeemNftSettlement: 32881960n,
    redeemRwaEscrow: 32920373n,
    airdropEscrow: 32861834n,
}

export function getContractAddresses(chainId: number): ContractAddressBag {
    return ADDRESSES_BY_CHAIN[chainId] ?? {}
}

// Server-side default (Route Handlers, sync poller). Client code should use useContractAddresses()
// instead, which resolves off the wallet's connected chain via wagmi's useChainId().
export const CONTRACT_ADDRESSES: ContractAddressBag = getContractAddresses(DEFAULT_CHAIN_ID)
