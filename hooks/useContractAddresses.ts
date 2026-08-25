'use client'

import { useChainId } from 'wagmi'
import { getContractAddresses } from '@/config/contract-addresses'

/** Resolves contract addresses off the wallet's actually-connected chain, not the deployment's
 *  NEXT_PUBLIC_CHAIN_ID — so switching networks in the wallet (see network-switcher.tsx) updates
 *  which addresses every hook/component reads without a page reload. */
export function useContractAddresses() {
    return getContractAddresses(useChainId())
}
