'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount, useChainId, useReadContract, useWriteContract, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import type { Address } from 'viem'
import { Check, PenLine, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { erc721Abi } from '@/lib/abis/erc721'
import { getPaymentTokens } from '@/lib/tokens'
import { useCollectionConfig } from '@/hooks/useCollections'
import { useListNftOrder } from '@/hooks/useListNftOrder'
import { toastSuccess, toastError } from '@/lib/toast'

const NFT_MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS as Address | undefined

export default function ListNftPage() {
    const router = useRouter()
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const publicClient = usePublicClient()
    const paymentTokens = getPaymentTokens(chainId)
    const { writeContractAsync } = useWriteContract()
    const listOrder = useListNftOrder()

    const [form, setForm] = useState({ contract: '', tokenId: '', name: '', imageUrl: '', price: '' })
    const [token, setToken] = useState(paymentTokens[0]?.symbol ?? '')
    const [approving, setApproving] = useState(false)

    const contractValid = /^0x[a-fA-F0-9]{40}$/.test(form.contract.trim())
    const { data: config } = useCollectionConfig(contractValid ? form.contract.trim() : undefined)
    const selectedToken = paymentTokens.find((t) => t.symbol === token)

    const { data: isApproved, refetch: refetchApproval } = useReadContract({
        address: contractValid ? (form.contract.trim() as Address) : undefined,
        abi: erc721Abi,
        functionName: 'isApprovedForAll',
        args: address && NFT_MARKETPLACE_ADDRESS ? [address, NFT_MARKETPLACE_ADDRESS] : undefined,
        query: { enabled: contractValid && Boolean(address) && Boolean(NFT_MARKETPLACE_ADDRESS) },
    })

    const incomplete =
        !contractValid || !form.tokenId.trim() || !Number(form.price) || !selectedToken || !config

    // Step 1 — setApprovalForAll(marketplace, true), one on-chain tx per collection
    const approve = async () => {
        if (!isConnected || !address) {
            toastError('Please connect your wallet first')
            return
        }
        if (!NFT_MARKETPLACE_ADDRESS) {
            toastError('NftMarketplace is not deployed yet')
            return
        }
        setApproving(true)
        try {
            const hash = await writeContractAsync({
                address: form.contract.trim() as Address,
                abi: erc721Abi,
                functionName: 'setApprovalForAll',
                args: [NFT_MARKETPLACE_ADDRESS, true],
            })
            await publicClient?.waitForTransactionReceipt({ hash })
            await refetchApproval()
            toastSuccess('Collection approved')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Approval failed')
        } finally {
            setApproving(false)
        }
    }

    // Step 2 — signTypedData (EIP-712, gasless) → POST /api/nft/orders
    const signAndList = async () => {
        if (!address || !selectedToken) return
        try {
            await listOrder.mutateAsync({
                seller: address,
                nftContract: form.contract.trim() as Address,
                tokenId: BigInt(form.tokenId.trim()),
                paymentToken: selectedToken.address,
                price: parseUnits(form.price, selectedToken.decimals),
                name: form.name.trim() || undefined,
                imageUrl: form.imageUrl.trim() || undefined,
            })
            toastSuccess('Listed for sale')
            router.push('/app/orders')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Listing failed')
        }
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">List an NFT</h1>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">NFT details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="contract">Collection contract</Label>
                        <Input
                            id="contract"
                            className="font-mono text-xs"
                            value={form.contract}
                            onChange={(e) => setForm({ ...form, contract: e.target.value })}
                        />
                        {contractValid && !config && (
                            <p className="text-xs text-destructive">
                                This collection isn&apos;t registered —{' '}
                                <Link href="/app/collections/register" className="underline">
                                    register it
                                </Link>{' '}
                                before listing.
                            </p>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="tokenId">Token ID</Label>
                            <Input
                                id="tokenId"
                                value={form.tokenId}
                                onChange={(e) => setForm({ ...form, tokenId: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Display name (optional)</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="imageUrl">Image URL (optional)</Label>
                        <Input
                            id="imageUrl"
                            placeholder="https://…"
                            value={form.imageUrl}
                            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="price">Price</Label>
                            <Input
                                id="price"
                                type="number"
                                min="0"
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Payment token</Label>
                            <div className="flex gap-1">
                                {paymentTokens.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        No payment tokens configured for this chain yet.
                                    </p>
                                ) : (
                                    paymentTokens.map((t) => (
                                        <Button
                                            key={t.symbol}
                                            type="button"
                                            size="sm"
                                            variant={token === t.symbol ? 'secondary' : 'outline'}
                                            onClick={() => setToken(t.symbol)}
                                        >
                                            {t.symbol}
                                        </Button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Step 1: approve the collection once (on-chain, gas)
                        </p>
                        <p className="flex items-center gap-1.5">
                            <PenLine className="h-3.5 w-3.5" />
                            Step 2: sign the listing order (EIP-712, gasless)
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant={isApproved ? 'outline' : 'default'}
                            className="flex-1"
                            disabled={incomplete || Boolean(isApproved) || approving}
                            isLoading={approving}
                            loadingText="Confirming on-chain…"
                            onClick={approve}
                        >
                            {isApproved ? (
                                <>
                                    <Check className="mr-1.5 h-4 w-4" /> Approved
                                </>
                            ) : (
                                '1. Approve collection'
                            )}
                        </Button>
                        <Button
                            className="flex-1"
                            disabled={incomplete || !isApproved || listOrder.isPending}
                            isLoading={listOrder.isPending}
                            loadingText="Waiting for signature…"
                            onClick={signAndList}
                        >
                            2. Sign &amp; list
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
