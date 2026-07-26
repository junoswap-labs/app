import type { Address } from 'viem'
import { permissionRegistryAbi } from '@/lib/abis/permission-registry'
import { permissionRegistryAddress, serverPublicClient } from '@/lib/onchain/public-client'

// Server-side role reads — the only legitimate way to answer "is this wallet an Admin/Partner?"
// per this project's decision that roles live entirely on PermissionRegistry.sol, never in the DB.
// Wrapped in cachedFetch (short TTL) since these get called on every admin-route request.
import { cachedFetch } from '@/lib/server-cache'

const ROLE_CHECK_TTL_SECONDS = 30

function readRole(fn: 'isAdmin' | 'isPartnerMarketplace' | 'isPartnerRedeem' | 'isAuthorized', wallet: Address) {
    return cachedFetch(
        `role:${fn}:${wallet.toLowerCase()}`,
        () =>
            serverPublicClient().readContract({
                address: permissionRegistryAddress(),
                abi: permissionRegistryAbi,
                functionName: fn,
                args: [wallet],
            }) as Promise<boolean>,
        ROLE_CHECK_TTL_SECONDS
    )
}

export const isAdminOnChain = (wallet: Address) => readRole('isAdmin', wallet)
export const isPartnerMarketplaceOnChain = (wallet: Address) => readRole('isPartnerMarketplace', wallet)
export const isPartnerRedeemOnChain = (wallet: Address) => readRole('isPartnerRedeem', wallet)
export const isAuthorizedOnChain = (wallet: Address) => readRole('isAuthorized', wallet)
