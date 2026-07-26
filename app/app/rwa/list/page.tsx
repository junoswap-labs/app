'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useChainId } from 'wagmi'
import { parseUnits } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImageUploadField } from '@/components/ui/image-upload'
import { AuthorizeGate } from '@/components/authorize/authorize-gate'
import { getPaymentTokens } from '@/lib/tokens'
import { useCreateRwaListing } from '@/hooks/useCreateRwaListing'
import { toastSuccess, toastError } from '@/lib/toast'

export default function ListRwaPage() {
    const router = useRouter()
    const { isConnected } = useAccount()
    const chainId = useChainId()
    const paymentTokens = getPaymentTokens(chainId)
    const createListing = useCreateRwaListing()

    const [form, setForm] = useState({ title: '', description: '', price: '' })
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [token, setToken] = useState(paymentTokens[0]?.symbol ?? '')

    const selectedToken = paymentTokens.find((t) => t.symbol === token)
    const incomplete = !form.title.trim() || !form.description.trim() || !Number(form.price) || !selectedToken

    const submit = async () => {
        if (!isConnected) {
            toastError('Please connect your wallet first')
            return
        }
        if (!selectedToken) return
        try {
            await createListing.mutateAsync({
                title: form.title.trim(),
                description: form.description.trim(),
                imageUrls: imageUrl ? [imageUrl] : [],
                price: parseUnits(form.price, selectedToken.decimals).toString(),
                paymentToken: selectedToken.address,
            })
            toastSuccess('Item listed')
            router.push('/app/orders')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Listing failed')
        }
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">List an Item</h1>
            <AuthorizeGate>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Item details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </div>
                        <ImageUploadField value={imageUrl} onChange={setImageUrl} label="Item photo" />
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
                        <Button
                            className="w-full"
                            disabled={incomplete || createListing.isPending}
                            isLoading={createListing.isPending}
                            loadingText="Creating listing…"
                            onClick={submit}
                        >
                            List item — no gas until it sells
                        </Button>
                    </CardContent>
                </Card>
            </AuthorizeGate>
        </div>
    )
}
