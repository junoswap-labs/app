'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { Check, PenLine, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KycGate } from '@/components/kyc/kyc-gate'
import { useMockListings } from '@/store/mock-listings'
import { mockTx } from '@/lib/mock/tx'
import { toastSuccess, toastError } from '@/lib/toast'

const PAYMENT_TOKENS = ['KKUB', 'JUNO', 'CMH'] as const
const DEFAULT_CONTRACT = '0x2F022D4Ef37847304eCd167303aeaA9699F73663'

export default function ListNftPage() {
    const router = useRouter()
    const { address, isConnected } = useAccount()
    const addListing = useMockListings((s) => s.addListing)

    const [form, setForm] = useState({
        contract: DEFAULT_CONTRACT,
        tokenId: '',
        name: '',
        imageUrl: '',
        price: '',
    })
    const [token, setToken] = useState<string>(PAYMENT_TOKENS[0])
    const [approved, setApproved] = useState(false)
    const [busy, setBusy] = useState<'approve' | 'sign' | null>(null)

    const incomplete = !form.contract.trim() || !form.tokenId.trim() || !Number(form.price)

    // Step 1 — real flow: setApprovalForAll(marketplace, true), one on-chain tx per collection
    const approve = async () => {
        if (!isConnected || !address) {
            toastError('Please connect your wallet first')
            return
        }
        setBusy('approve')
        await mockTx()
        setApproved(true)
        setBusy(null)
        toastSuccess('Collection approved (mock)')
    }

    // Step 2 — real flow: signTypedData (EIP-712, gasless) → POST /api/nft/orders
    const signAndList = async () => {
        setBusy('sign')
        await mockTx(800)
        addListing({
            contract: form.contract.trim() as `0x${string}`,
            tokenId: form.tokenId.trim(),
            name: form.name.trim() || `Token #${form.tokenId.trim()}`,
            imageUrl: form.imageUrl.trim() || null,
            price: form.price,
            paymentToken: token,
            seller: address!,
            status: 'active',
            listedAt: Date.now(),
        })
        setBusy(null)
        toastSuccess('Listed — signature stored (mock)')
        router.push('/app/orders')
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">List an NFT</h1>
            <KycGate>
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
                                onChange={(e) => {
                                    setForm({ ...form, contract: e.target.value })
                                    setApproved(false)
                                }}
                            />
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
                                    {PAYMENT_TOKENS.map((t) => (
                                        <Button
                                            key={t}
                                            type="button"
                                            size="sm"
                                            variant={token === t ? 'secondary' : 'outline'}
                                            onClick={() => setToken(t)}
                                        >
                                            {t}
                                        </Button>
                                    ))}
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
                                variant={approved ? 'outline' : 'default'}
                                className="flex-1"
                                disabled={incomplete || approved || busy !== null}
                                isLoading={busy === 'approve'}
                                loadingText="Confirming on-chain…"
                                onClick={approve}
                            >
                                {approved ? (
                                    <>
                                        <Check className="mr-1.5 h-4 w-4" /> Approved
                                    </>
                                ) : (
                                    '1. Approve collection'
                                )}
                            </Button>
                            <Button
                                className="flex-1"
                                disabled={incomplete || !approved || busy !== null}
                                isLoading={busy === 'sign'}
                                loadingText="Waiting for signature…"
                                onClick={signAndList}
                            >
                                2. Sign &amp; list
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </KycGate>
        </div>
    )
}
