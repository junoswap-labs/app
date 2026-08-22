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
import { TokenAmountInput } from '@/components/ui/token-amount-input'
import type { SelectedToken } from '@/components/ui/token-amount-input'
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
    const [token, setToken] = useState<SelectedToken | null>(
        paymentTokens[0] ? { address: paymentTokens[0].address, decimals: paymentTokens[0].decimals, symbol: paymentTokens[0].symbol } : null
    )

    const incomplete = !form.title.trim() || !form.description.trim() || !Number(form.price) || !token?.address.trim()

    const submit = async () => {
        if (!isConnected) {
            toastError('Please connect your wallet first')
            return
        }
        if (!token?.address.trim()) return
        try {
            await createListing.mutateAsync({
                title: form.title.trim(),
                description: form.description.trim(),
                imageUrls: imageUrl ? [imageUrl] : [],
                price: parseUnits(form.price, token.decimals).toString(),
                paymentToken: token.address,
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
                        <div className="space-y-1.5">
                            <Label htmlFor="price">Price</Label>
                            <TokenAmountInput
                                id="price"
                                amount={form.price}
                                onAmountChange={(v) => setForm({ ...form, price: v })}
                                tokens={paymentTokens}
                                token={token}
                                onTokenChange={setToken}
                            />
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
