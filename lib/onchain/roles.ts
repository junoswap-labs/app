import type { Address } from 'viem'
import { permissionRegistryAbi } from '@/lib/abis/permission-registry'
import { permissionRegistryAddress, serverPublicClient } from '@/lib/onchain/public-client'
import { isDevRoleBypassActive } from '@/lib/onchain/dev-bypass'
import { SUPPORTED_CHAIN_IDS, getContractAddresses } from '@/config/contract-addresses'

// Server-side role reads — the only legitimate way to answer "is this wallet an Admin/Partner?"
// per this project's decision that roles live entirely on PermissionRegistry.sol, never in the DB.
// Wrapped in cachedFetch (short TTL) since these get called on every admin-route request.
//
// Multi-chain: PermissionRegistry is deployed per chain, and a wallet holding a role on ANY
// supported chain is treated as holding it — the DB-only admin gates aren't chain-specific, and
// for on-chain actions the contract's own modifier is the real gate anyway (see CLAUDE.md's Clean
// Workflow), so a permissive read here is safe.
import { cachedFetch } from '@/lib/server-cache'

const ROLE_CHECK_TTL_SECONDS = 30

const CHAINS_WITH_REGISTRY = SUPPORTED_CHAIN_IDS.filter(
    (chainId) => getContractAddresses(chainId).permissionRegistry
)

function readRoleOnChain(
    fn: 'isAdmin' | 'isPartnerMarketplace' | 'isPartnerRedeem' | 'isAuthorized',
    wallet: Address,
    chainId: number
) {
    return serverPublicClient(chainId).readContract({
        address: permissionRegistryAddress(chainId),
        abi: permissionRegistryAbi,
        functionName: fn,
        args: [wallet],
    }) as Promise<boolean>
}

function readRole(fn: 'isAdmin' | 'isPartnerMarketplace' | 'isPartnerRedeem' | 'isAuthorized', wallet: Address) {
    if (isDevRoleBypassActive()) return Promise.resolve(true)
    return cachedFetch(
        `role:${fn}:${wallet.toLowerCase()}`,
        async () => {
            const results = await Promise.all(
                CHAINS_WITH_REGISTRY.map((chainId) => readRoleOnChain(fn, wallet, chainId))
            )
            return results.some(Boolean)
        },
        ROLE_CHECK_TTL_SECONDS
    )
}

export const isAdminOnChain = (wallet: Address) => readRole('isAdmin', wallet)
export const isPartnerMarketplaceOnChain = (wallet: Address) => readRole('isPartnerMarketplace', wallet)
export const isPartnerRedeemOnChain = (wallet: Address) => readRole('isPartnerRedeem', wallet)
export const isAuthorizedOnChain = (wallet: Address) => readRole('isAuthorized', wallet)
