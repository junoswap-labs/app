'use client'

import { useCallback } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { BaseError, ContractFunctionRevertedError } from 'viem'
import type { Abi, Address } from 'viem'

interface WriteParams {
    address: Address
    abi: Abi | readonly unknown[]
    functionName: string
    args?: readonly unknown[]
    value?: bigint
}

/**
 * eth_call the contract with the exact calldata first, then send only if it succeeds. A tx that
 * reverts on-chain still burns the sender's gas, and the wallet's own pre-flight is not reliable
 * here (some wallets skip it, and a stale UI can hold state the contract has already moved past —
 * an order filled by someone else a block earlier, an expired deadline, a spent claim).
 *
 * Sending the `request` simulateContract returns, rather than re-building the call, means the tx
 * broadcast is byte-identical to what was verified.
 */
export function useSimulatedWrite() {
    const { address } = useAccount()
    const publicClient = usePublicClient()
    const { writeContractAsync } = useWriteContract()

    return useCallback(
        async (params: WriteParams): Promise<`0x${string}`> => {
            if (!publicClient) throw new Error('no public client available')
            if (!address) throw new Error('connect your wallet first')

            let request
            try {
                ;({ request } = await publicClient.simulateContract({
                    ...params,
                    account: address,
                } as Parameters<typeof publicClient.simulateContract>[0]))
            } catch (err) {
                throw new Error(revertMessage(err))
            }

            return writeContractAsync(request as Parameters<typeof writeContractAsync>[0])
        },
        [address, publicClient, writeContractAsync]
    )
}

/** Surfaces the contract's own `require` string / custom error name instead of viem's full multi-
 *  paragraph dump, which is unreadable inside a toast. */
function revertMessage(err: unknown): string {
    if (err instanceof BaseError) {
        const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError)
        if (reverted instanceof ContractFunctionRevertedError) {
            return reverted.data?.errorName ?? reverted.reason ?? reverted.shortMessage
        }
        return err.shortMessage
    }
    return err instanceof Error ? err.message : 'transaction would revert'
}
