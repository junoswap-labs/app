import { Hono } from 'hono'
import { isAddress } from 'viem'
import { CLAIM_FOR_GAS_UNITS, airdropEscrowAddress, publicClient, walletClient } from '../chain'
import { claimForAbi, getCampaignAbi } from '../abi'
import { enqueue } from '../queue'

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/

const relayClaim = new Hono()

/**
 * The main app's POST /api/airdrop/claim has already authenticated the caller (SIWE session) and
 * run the GPS/IP checks before ever reaching here — this endpoint does not re-verify any of that,
 * it only checks the shared secret and that the request shape is well-formed. See
 * contracts/src/AirdropEscrow.sol's claimFor() doc comment for the full trust-boundary rationale.
 */
relayClaim.post('/relay-claim', async (c) => {
    const secret = c.req.header('x-relayer-secret')
    if (!secret || secret !== process.env.SHARED_SECRET) {
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

    try {
        const campaign = await publicClient.readContract({
            address: airdropEscrowAddress,
            abi: getCampaignAbi,
            functionName: 'getCampaign',
            args: [campaignId as `0x${string}`],
        })
        const remainingGasDeposit = campaign.gasDeposit - campaign.gasSpent
        if (remainingGasDeposit <= 0n) {
            return c.json({ error: 'this campaign has no gas deposit left to cover the relay — ask the claimant to pay their own gas' }, 409)
        }

        const gasPrice = await publicClient.getGasPrice()
        const gasReimbursement = (CLAIM_FOR_GAS_UNITS * gasPrice * 13n) / 10n

        const hash = await enqueue((nonce) =>
            walletClient.writeContract({
                address: airdropEscrowAddress,
                abi: claimForAbi,
                functionName: 'claimFor',
                args: [campaignId as `0x${string}`, recipient, gasReimbursement],
                nonce,
            })
        )
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        return c.json({ txHash: hash, status: receipt.status === 'success' ? 'confirmed' : 'failed' })
    } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : 'relay failed' }, 500)
    }
})

export default relayClaim
