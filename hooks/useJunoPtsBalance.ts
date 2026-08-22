'use client'

import { useAccount, useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { junoPtsAbi } from '@/lib/abis/juno-pts'

const JUNO_PTS_ADDRESS = process.env.NEXT_PUBLIC_JUNO_PTS_ADDRESS as Address | undefined

/** Live on-chain Points balance for the connected wallet — never a DB/mock value. */
export function useJunoPtsBalance() {
    const { address } = useAccount()
    return useReadContract({
        address: JUNO_PTS_ADDRESS,
        abi: junoPtsAbi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: Boolean(JUNO_PTS_ADDRESS && address) },
    })
}
