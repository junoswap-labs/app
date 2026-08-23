'use client'

import { useAccount, useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { junoPtsAbi } from '@/lib/abis/juno-pts'
import { useContractAddresses } from '@/hooks/useContractAddresses'

/** Live on-chain Points balance for the connected wallet — never a DB/mock value. */
export function useJunoPtsBalance() {
    const { junoPts: JUNO_PTS_ADDRESS } = useContractAddresses()
    const { address } = useAccount()
    return useReadContract({
        address: JUNO_PTS_ADDRESS,
        abi: junoPtsAbi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: Boolean(JUNO_PTS_ADDRESS && address) },
    })
}
