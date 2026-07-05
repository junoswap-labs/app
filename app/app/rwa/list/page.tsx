'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { KycGate } from '@/components/kyc/kyc-gate'
import { useMockRwa } from '@/store/mock-rwa'
import { toastSuccess, toastError } from '@/lib/toast'

const PAYMENT_TOKENS = ['KKUB', 'JUNO', 'CMH'] as const

export default function ListRwaPage() {
    const router = useRouter()
    const { address, isConnected } = useAccount()
    const addListing = useMockRwa((s) => s.addListing)
    const [form, setForm] = useState({ title: '', description: '', imageUrl: '', price: '' })
    const [token, setToken] = useState<string>(PAYMENT_TOKENS[0])
    const [submitting, setSubmitting] = useState(false)

    const incomplete = !form.title.trim() || !form.description.trim() || !Number(form.price)

    // Listing an RWA is off-chain (no gas until someone funds) — real flow is
    // image upload to Storage + POST /api/rwa/listings.
    const submit = async () => {
        if (!isConnected || !address) {
            toastError('Please connect your wallet first')
            return
        }
        setSubmitting(true)
        await new Promise((r) => setTimeout(r, 600))
        addListing({
            id: `rwa-${Date.now()}`,
            title: form.title.trim(),
            description: form.description.trim(),
            imageUrls: form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
            price: form.price,
            paymentToken: token,
            seller: address,
            status: 'listed',
            createdAt: Date.now(),
        })
        toastSuccess('Item listed (mock)')
        router.push('/app/orders')
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold tracking-tight">List an Item</h1>
            <KycGate>
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
                        <div className="space-y-1.5">
                            <Label htmlFor="imageUrl">Image URL</Label>
                            <Input
                                id="imageUrl"
                                placeholder="https://…"
                                value={form.imageUrl}
                                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Mock phase: paste an image URL. Real flow uploads to storage and
                                keeps only URLs in the database.
                            </p>
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
                        <Button
                            className="w-full"
                            disabled={incomplete}
                            isLoading={submitting}
                            loadingText="Creating listing…"
                            onClick={submit}
                        >
                            List item — no gas until it sells
                        </Button>
                    </CardContent>
                </Card>
            </KycGate>
        </div>
    )
}
