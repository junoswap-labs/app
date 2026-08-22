import type { Address, PublicClient } from 'viem'
import { erc20Abi, kap20AllowancesAbi } from '@/lib/abis/erc20'

/**
 * Reads an ERC20-style allowance, falling back to KAP20's `allowances(owner,spender)` getter
 * (plural) when the standard `allowance(owner,spender)` call reverts — Bitkub Chain's official
 * KAP20 token template (e.g. KUSDT) doesn't implement the standard name at all, only the plural
 * one. transfer/transferFrom/approve are standard-named on that template, so only the read side
 * needs a fallback.
 */
export async function readTokenAllowance(
    publicClient: PublicClient,
    token: Address,
    owner: Address,
    spender: Address
): Promise<bigint> {
    try {
        return await publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [owner, spender],
        })
    } catch {
        return await publicClient.readContract({
            address: token,
            abi: kap20AllowancesAbi,
            functionName: 'allowances',
            args: [owner, spender],
        })
    }
}

type WriteContractAsync = (args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
}) => Promise<`0x${string}`>

/**
 * Ensures `spender` can pull at least `amount` of `token` from `owner` — approves (and waits for
 * confirmation) only if the live allowance is short, so a partial prior approval is topped up
 * rather than skipped or over-approved. Resets to 0 first when there's a nonzero prior allowance
 * being changed: tokens modeled on Tether's USDT (KUSDT included) reject a direct
 * nonzero-to-nonzero approve() to close the classic approval-race condition.
 */
export async function ensureTokenAllowance(params: {
    publicClient: PublicClient
    writeContractAsync: WriteContractAsync
    token: Address
    owner: Address
    spender: Address
    amount: bigint
    approveAbi?: readonly unknown[]
}): Promise<void> {
    const { publicClient, writeContractAsync, token, owner, spender, amount, approveAbi = erc20Abi } = params
    const allowance = await readTokenAllowance(publicClient, token, owner, spender)
    if (allowance >= amount) return

    if (allowance > 0n) {
        const resetHash = await writeContractAsync({ address: token, abi: approveAbi, functionName: 'approve', args: [spender, 0n] })
        await publicClient.waitForTransactionReceipt({ hash: resetHash })
    }

    const approveHash = await writeContractAsync({ address: token, abi: approveAbi, functionName: 'approve', args: [spender, amount] })
    await publicClient.waitForTransactionReceipt({ hash: approveHash })
}
