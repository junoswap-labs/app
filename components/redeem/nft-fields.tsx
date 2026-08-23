'use client'

import { useState } from 'react'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { erc721Abi } from '@/lib/abis/erc721'
import { redeemNftSettlementAbi } from '@/lib/abis/redeem-nft-settlement'
import { toastSuccess, toastError } from '@/lib/toast'
import { useContractAddresses } from '@/hooks/useContractAddresses'
import type { RedeemTier } from '@/types/redeem'

export function NftFields({
    tier,
    nftContract,
    nftTokenId,
    setNftContract,
    setNftTokenId,
}: {
    tier: RedeemTier
    nftContract: string
    nftTokenId: string
    setNftContract: (v: string) => void
    setNftTokenId: (v: string) => void
}) {
    const { redeemNftSettlement: REDEEM_NFT_SETTLEMENT_ADDRESS } = useContractAddresses()
    const { address } = useAccount()
    const publicClient = usePublicClient()
    const { writeContractAsync } = useWriteContract()
    const [depositing, setDepositing] = useState(false)

    const { data: treasury } = useReadContract({
        address: REDEEM_NFT_SETTLEMENT_ADDRESS,
        abi: redeemNftSettlementAbi,
        functionName: 'treasury',
        query: { enabled: Boolean(REDEEM_NFT_SETTLEMENT_ADDRESS) },
    })

    const tokenIdBigint = (() => {
        try {
            return nftTokenId ? BigInt(nftTokenId) : null
        } catch {
            return null
        }
    })()

    const { data: owner, refetch: refetchOwner } = useReadContract({
        address: nftContract && nftContract.startsWith('0x') ? (nftContract as Address) : undefined,
        abi: erc721Abi,
        functionName: 'ownerOf',
        args: tokenIdBigint != null ? [tokenIdBigint] : undefined,
        query: { enabled: Boolean(nftContract && tokenIdBigint != null) },
    })

    const vaulted = Boolean(owner && treasury && owner.toLowerCase() === treasury.toLowerCase())

    const depositToVault = async () => {
        if (!nftContract || tokenIdBigint == null || !treasury || !address || !publicClient) return
        setDepositing(true)
        try {
            const hash = await writeContractAsync({
                address: nftContract as Address,
                abi: erc721Abi,
                functionName: 'transferFrom',
                args: [address, treasury, tokenIdBigint],
            })
            await publicClient.waitForTransactionReceipt({ hash })
            await refetchOwner()
            toastSuccess('NFT deposited to the Redeem vault')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Deposit failed')
        } finally {
            setDepositing(false)
        }
    }

    return (
        <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="nftContract">NFT contract</Label>
                    <Input id="nftContract" placeholder="0x…" value={nftContract} onChange={(e) => setNftContract(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="nftTokenId">Token ID</Label>
                    <Input id="nftTokenId" type="number" min="0" value={nftTokenId} onChange={(e) => setNftTokenId(e.target.value)} />
                </div>
            </div>
            {tier === 'registered' && (
                <div className="rounded-md border p-3 text-sm">
                    {!REDEEM_NFT_SETTLEMENT_ADDRESS ? (
                        <p className="text-muted-foreground">Redeem NFT settlement isn&apos;t deployed yet.</p>
                    ) : vaulted ? (
                        <p className="text-emerald-600">Deposited — this token is held by the Redeem vault, ready to list.</p>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-muted-foreground">
                                Registered NFTs must be transferred into the Redeem vault before listing — this locks the
                                token here; once a redemption order exists it can no longer be withdrawn.
                            </p>
                            <Button type="button" size="sm" disabled={!nftContract || tokenIdBigint == null || depositing} isLoading={depositing} loadingText="Depositing…" onClick={depositToVault}>
                                Deposit to vault
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
