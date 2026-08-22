'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { junoPtsAbi } from '@/lib/abis/juno-pts'
import { redeemNftSettlementAbi } from '@/lib/abis/redeem-nft-settlement'
import { rwaEscrowAbi } from '@/lib/abis/rwa-escrow'
import { ensureTokenAllowance } from '@/lib/onchain/erc20'
import { useSyncRefresh } from '@/hooks/useSyncRefresh'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import type { ShippingInfo } from '@/types/redeem'

const REDEEM_RWA_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_REDEEM_RWA_ESCROW_ADDRESS as Address | undefined

interface CreateRedeemOrderInput {
    itemId: number
    variantId?: number
    shipping?: ShippingInfo // merch only
}

interface NftOfferResponse {
    order: { id: string }
    offer: {
        itemId: string
        operator: Address
        buyer: Address
        nftContract: Address
        tokenId: string
        tier: 0 | 1
        payoutWallet: Address
        // Always exactly 3 (RedeemOffer.legs is a fixed-size tuple on-chain — see contracts/src/RedeemNftSettlement.sol).
        legs: [{ token: Address; amount: string }, { token: Address; amount: string }, { token: Address; amount: string }]
        nonce: string
        expiry: string
    }
    signature: `0x${string}`
    settlementAddress: Address
}

interface MerchEscrowResponse {
    order: { id: string }
    escrow: { listingId: `0x${string}`; seller: Address; paymentToken: Address; amount: string; pricePoints: string }
}

/**
 * STEP 2 — "กดคลิกแลกสินค้า": creates the order via the Route Handler (see app/api/redeem/orders),
 * then performs the buyer's own on-chain tx(s) with the returned offer/escrow details, and finally
 * runs the Clean Workflow tail (useSyncRefresh -> invalidate) so the order's real status is read
 * back from Supabase once the poller has processed the confirmed tx, never assumed from the receipt.
 */
export function useCreateRedeemOrder() {
    const { address } = useAccount()
    const { writeContractAsync } = useWriteContract()
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (input: CreateRedeemOrderInput) => {
            if (!address) throw new Error('connect your wallet first')
            if (!publicClient) throw new Error('no public client available')

            const res = await fetch('/api/redeem/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: input.itemId, variant_id: input.variantId, shipping: input.shipping }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `redeem failed: ${res.status}`)
            }
            const body = (await res.json()) as NftOfferResponse | MerchEscrowResponse

            if ('offer' in body) {
                const { offer, signature, settlementAddress } = body
                const ptsLeg = offer.legs[0]
                if (BigInt(ptsLeg.amount) > 0n) {
                    await ensureTokenAllowance({
                        publicClient,
                        writeContractAsync,
                        token: ptsLeg.token,
                        owner: address,
                        spender: settlementAddress,
                        amount: BigInt(ptsLeg.amount),
                        approveAbi: junoPtsAbi,
                    })
                }
                const tokenLeg = offer.legs[1]
                if (tokenLeg.amount !== '0' && tokenLeg.token !== '0x0000000000000000000000000000000000000000') {
                    await ensureTokenAllowance({
                        publicClient,
                        writeContractAsync,
                        token: tokenLeg.token,
                        owner: address,
                        spender: settlementAddress,
                        amount: BigInt(tokenLeg.amount),
                    })
                }

                const hash = await write({
                    address: settlementAddress,
                    abi: redeemNftSettlementAbi,
                    functionName: 'redeem',
                    args: [
                        {
                            itemId: BigInt(offer.itemId),
                            operator: offer.operator,
                            buyer: offer.buyer,
                            nftContract: offer.nftContract,
                            tokenId: BigInt(offer.tokenId),
                            tier: offer.tier,
                            payoutWallet: offer.payoutWallet,
                            legs: offer.legs.map((l) => ({ token: l.token, amount: BigInt(l.amount) })) as [
                                { token: Address; amount: bigint },
                                { token: Address; amount: bigint },
                                { token: Address; amount: bigint },
                            ],
                            nonce: BigInt(offer.nonce),
                            expiry: BigInt(offer.expiry),
                        },
                        signature,
                    ],
                })
                await publicClient.waitForTransactionReceipt({ hash })
            } else {
                if (!REDEEM_RWA_ESCROW_ADDRESS) throw new Error('Redeem escrow is not deployed yet')
                const { escrow } = body
                if (BigInt(escrow.pricePoints) > 0n) {
                    const junoPtsAddress = process.env.NEXT_PUBLIC_JUNO_PTS_ADDRESS as Address | undefined
                    if (!junoPtsAddress) throw new Error('JunoPts is not deployed yet')
                    const burnHash = await write({
                        address: junoPtsAddress,
                        abi: junoPtsAbi,
                        functionName: 'burn',
                        args: [BigInt(escrow.pricePoints)],
                    })
                    await publicClient.waitForTransactionReceipt({ hash: burnHash })
                }

                const amount = BigInt(escrow.amount)
                await ensureTokenAllowance({
                    publicClient,
                    writeContractAsync,
                    token: escrow.paymentToken,
                    owner: address,
                    spender: REDEEM_RWA_ESCROW_ADDRESS,
                    amount,
                })

                const fundHash = await write({
                    address: REDEEM_RWA_ESCROW_ADDRESS,
                    abi: rwaEscrowAbi,
                    functionName: 'fund',
                    args: [escrow.listingId, escrow.seller, escrow.paymentToken, amount],
                })
                await publicClient.waitForTransactionReceipt({ hash: fundHash })
            }

            await syncRefresh.mutateAsync()
            return body.order
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['redeem-orders'] })
            queryClient.invalidateQueries({ queryKey: ['redeem-items'] })
        },
    })
}
