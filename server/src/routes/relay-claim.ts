import { Hono } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { BaseError, ContractFunctionRevertedError, isAddress } from 'viem'
import { CLAIM_FOR_GAS_UNITS, account, airdropEscrowAddress, publicClient, requireEnv, walletClient } from '../chain'
import { claimForAbi, getCampaignAbi } from '../abi'
import { enqueue } from '../queue'
import { claim, settle } from '../claim-guard'

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/

// Read at module load, not per-request: a relayer booted without a secret would otherwise compare
// against undefined and run wide open. Missing env must kill the process, not serve traffic.
const sharedSecret = Buffer.from(requireEnv('SHARED_SECRET'))

function secretMatches(header: string | undefined): boolean {
    if (!header) return false
    const given = Buffer.from(header)
    // timingSafeEqual throws on length mismatch, so compare lengths first — that leaks only the
    // secret's length, which the constant-time compare below is what actually matters for.
    return given.length === sharedSecret.length && timingSafeEqual(given, sharedSecret)
}

const relayClaim = new Hono()

/**
 * The main app's POST /api/airdrop/claim has already authenticated the caller (SIWE session) and
 * run the GPS/IP checks before ever reaching here — this endpoint does not re-verify any of that,
 * it only checks the shared secret and that the request shape is well-formed. See
 * contracts/src/AirdropEscrow.sol's claimFor() doc comment for the full trust-boundary rationale.
 */
relayClaim.post('/relay-claim', async (c) => {
    if (!secretMatches(c.req.header('x-relayer-secret'))) {
        return c.json({ error: 'unauthorized' }, 401)
    }

    const body = await c.req.json().catch(() => null)
    const campaignId = body?.campaignId
    const recipient = body?.recipient
    if (typeof campaignId !== 'string' || !BYTES32_RE.test(campaignId)) {
        return c.json({ error: 'campaignId must be a bytes32 hex string' }, 400)
    }
    if (typeof recipient !== 'string' || !isAddress(recipient)) {
        return c.json({ error: 'recipient must be a valid address' }, 400)
    }

    const blocked = claim(campaignId, recipient)
    if (blocked) {
        return c.json({ error: blocked === 'already-relayed' ? 'this claim was already relayed' : 'a relay for this claim is already in flight' }, 409)
    }

    try {
        const campaign = await publicClient.readContract({
            address: airdropEscrowAddress,
            abi: getCampaignAbi,
            functionName: 'getCampaign',
            args: [campaignId as `0x${string}`],
        })
        const remainingGasDeposit = campaign.gasDeposit - campaign.gasSpent
        if (remainingGasDeposit <= 0n) {
            settle(campaignId, recipient, false)
            return c.json({ error: 'this campaign has no gas deposit left to cover the relay — ask the claimant to pay their own gas' }, 409)
        }

        const gasPrice = await publicClient.getGasPrice()
        const gasReimbursement = (CLAIM_FOR_GAS_UNITS * gasPrice * 13n) / 10n

        // eth_call first: claimFor() reverts on an already-claimed recipient, an ended campaign, or
        // a drained pool, and a reverted tx still spends the relayer's gas for nothing. Simulating
        // turns that into a free 409 instead.
        const { request } = await publicClient.simulateContract({
            account,
            address: airdropEscrowAddress,
            abi: claimForAbi,
            functionName: 'claimFor',
            args: [campaignId as `0x${string}`, recipient, gasReimbursement],
        })

        const hash = await enqueue((nonce) => walletClient.writeContract({ ...request, nonce }))
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        const confirmed = receipt.status === 'success'
        settle(campaignId, recipient, confirmed)
        return c.json({ txHash: hash, status: confirmed ? 'confirmed' : 'failed' })
    } catch (err) {
        settle(campaignId, recipient, false)
        // A revert surfaced by the simulation is the caller's problem (already claimed, campaign
        // ended, bad signature) — 409, not 500, and without viem's multi-paragraph dump.
        if (err instanceof BaseError) {
            const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError)
            if (reverted instanceof ContractFunctionRevertedError) {
                return c.json({ error: reverted.data?.errorName ?? reverted.reason ?? reverted.shortMessage }, 409)
            }
            return c.json({ error: err.shortMessage }, 500)
        }
        return c.json({ error: err instanceof Error ? err.message : 'relay failed' }, 500)
    }
})

export default relayClaim
