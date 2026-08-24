'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChainId } from 'wagmi'
import { parseUnits } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { TokenAmountInput } from '@/components/ui/token-amount-input'
import type { SelectedToken } from '@/components/ui/token-amount-input'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { ImageUploadField } from '@/components/ui/image-upload'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useMyRedeemItem } from '@/hooks/useRedeemItems'
import { useUpdateRedeemItem } from '@/hooks/useUpdateRedeemItem'
import { getPaymentTokens } from '@/lib/tokens'
import { JUNO_PTS_DECIMALS } from '@/types/redeem'
import { toastSuccess, toastError } from '@/lib/toast'
import type { RedeemItemStatus } from '@/types/redeem'
import { getContractAddresses } from '@/config/contract-addresses'

interface VariantRow {
    id?: number
    label: string
    sku: string
    stock: string // empty = unlimited
}

/** Local "YYYY-MM-DDTHH:mm" for DateTimePicker from a DB ISO timestamp (or null -> ''). */
function toDateTimeLocal(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditRedeemItemPage({ params }: { params: Promise<{ itemId: string }> }) {
    const { itemId } = use(params)
    const router = useRouter()
    const chainId = useChainId()
    const { data: item, isLoading, error } = useMyRedeemItem(itemId)
    const update = useUpdateRedeemItem()

    const { junoPts: JUNO_PTS_ADDRESS } = getContractAddresses(chainId)
    const paymentTokens = getPaymentTokens(chainId)
    const pointsOption = JUNO_PTS_ADDRESS ? [{ symbol: 'PTS', address: JUNO_PTS_ADDRESS, decimals: JUNO_PTS_DECIMALS }] : []
    const tokenOptions = [...pointsOption, ...paymentTokens]

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [imageUrls, setImageUrls] = useState<(string | null)[]>([null])
    const [amount1, setAmount1] = useState('')
    const [token1, setToken1] = useState<SelectedToken | null>(null)
    const [amount2, setAmount2] = useState('')
    const [token2, setToken2] = useState<SelectedToken | null>(null)
    const [stock, setStock] = useState('')
    const [maxPerWallet, setMaxPerWallet] = useState('')
    const [variants, setVariants] = useState<VariantRow[]>([])
    const [publishAt, setPublishAt] = useState('')
    const [redeemStartAt, setRedeemStartAt] = useState('')
    const [redeemEndAt, setRedeemEndAt] = useState('')
    const [status, setStatus] = useState<RedeemItemStatus>('draft')

    // Prefill once the item loads — price_points/payment_token map back into the Token1/Token2
    // slots the same way the create form maps them out (see app/app/redeem/list/page.tsx).
    useEffect(() => {
        if (!item) return
        setName(item.name)
        setDescription(item.description)
        setImageUrls(item.image_urls.length > 0 ? item.image_urls : [null])
        setStock(item.stock != null ? String(item.stock) : '')
        setMaxPerWallet(item.max_per_wallet != null ? String(item.max_per_wallet) : '')
        setVariants((item.variants ?? []).map((v) => ({ id: v.id, label: v.label, sku: v.sku ?? '', stock: v.stock != null ? String(v.stock) : '' })))
        setPublishAt(toDateTimeLocal(item.publish_at))
        setRedeemStartAt(toDateTimeLocal(item.redeem_start_at))
        setRedeemEndAt(toDateTimeLocal(item.redeem_end_at))
        setStatus(item.status)

        const hasPoints = BigInt(item.price_points || '0') > 0n
        const hasToken = Boolean(item.payment_token && item.payment_amount && BigInt(item.payment_amount) > 0n)
        if (hasPoints && JUNO_PTS_ADDRESS) {
            setToken1({ address: JUNO_PTS_ADDRESS, decimals: JUNO_PTS_DECIMALS, symbol: 'PTS' })
            setAmount1(Number(BigInt(item.price_points)) / 10 ** JUNO_PTS_DECIMALS + '')
        }
        if (hasToken && item.payment_token && item.payment_amount) {
            const known = paymentTokens.find((t) => t.address.toLowerCase() === item.payment_token?.toLowerCase())
            const decimals = known?.decimals ?? 18
            const token: SelectedToken = { address: item.payment_token, decimals, symbol: item.payment_token_symbol ?? known?.symbol }
            const amountStr = (Number(BigInt(item.payment_amount)) / 10 ** decimals).toString()
            if (hasPoints) {
                setToken2(token)
                setAmount2(amountStr)
            } else {
                setToken1(token)
                setAmount1(amountStr)
            }
        }
        // Only run when the fetched item itself changes, not on every paymentTokens re-derivation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item])

    if (isLoading) return <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 text-sm text-muted-foreground">Loading…</div>
    if (error || !item) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState title="Can't load this listing" description={error instanceof Error ? error.message : 'Not found, or not yours.'} />
            </div>
        )
    }

    const isPoints = (t: SelectedToken | null) => Boolean(t?.address && JUNO_PTS_ADDRESS && t.address.toLowerCase() === JUNO_PTS_ADDRESS.toLowerCase())
    const pointsLeg = isPoints(token1) ? { token: token1, amount: amount1 } : isPoints(token2) ? { token: token2, amount: amount2 } : null
    const tokenLeg = !isPoints(token1) && token1 ? { token: token1, amount: amount1 } : !isPoints(token2) && token2 ? { token: token2, amount: amount2 } : null

    const incomplete =
        !name.trim() ||
        !description.trim() ||
        (item.kind === 'merch' && (!token1?.address?.trim() || !Number(amount1) || !tokenLeg))

    const addVariant = () => setVariants((v) => [...v, { label: '', sku: '', stock: '' }])
    const updateVariant = (i: number, patch: Partial<VariantRow>) =>
        setVariants((v) => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
    const removeVariant = (i: number) => setVariants((v) => v.filter((_, idx) => idx !== i))

    const submit = async () => {
        try {
            await update.mutateAsync({
                id: item.id,
                name: name.trim(),
                description: description.trim(),
                image_urls: imageUrls.filter((u): u is string => Boolean(u)),
                price_points: pointsLeg?.token && pointsLeg.amount ? parseUnits(pointsLeg.amount, pointsLeg.token.decimals).toString() : '0',
                payment_token: tokenLeg?.token?.address ?? null,
                payment_token_symbol: tokenLeg?.token?.symbol ?? null,
                payment_amount: tokenLeg?.token && tokenLeg.amount ? parseUnits(tokenLeg.amount, tokenLeg.token.decimals).toString() : null,
                stock: item.kind === 'merch' && variants.length === 0 && stock ? Number(stock) : null,
                max_per_wallet: maxPerWallet ? Number(maxPerWallet) : null,
                variants:
                    item.kind === 'merch'
                        ? variants
                              .filter((v) => v.label.trim())
                              .map((v) => ({ id: v.id, label: v.label.trim(), sku: v.sku.trim() || undefined, stock: v.stock ? Number(v.stock) : null }))
                        : undefined,
                publish_at: publishAt ? new Date(publishAt).toISOString() : null,
                redeem_start_at: redeemStartAt ? new Date(redeemStartAt).toISOString() : null,
                redeem_end_at: redeemEndAt ? new Date(redeemEndAt).toISOString() : null,
                status,
            })
            toastSuccess('Listing updated')
            router.push('/app/redeem')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Update failed')
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <Breadcrumb items={[{ label: 'Redeem', href: '/app/redeem' }, { label: 'Manage' }, { label: item.name }]} />
            <h1 className="text-2xl font-semibold tracking-tight">Edit listing</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Item details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <div className="flex gap-1">
                            {(['draft', 'published', 'archived'] as const).map((s) => (
                                <Button key={s} type="button" size="sm" variant={status === s ? 'secondary' : 'outline'} onClick={() => setStatus(s)}>
                                    {s}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Photos (up to 3)</Label>
                        <div className="flex flex-wrap items-start gap-3">
                            {imageUrls.map((url, i) => (
                                <ImageUploadField
                                    key={i}
                                    value={url}
                                    onChange={(v) => setImageUrls((prev) => prev.map((u, idx) => (idx === i ? v : u)))}
                                    label={i === 0 ? 'Cover photo' : `Photo ${i + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {item.kind === 'merch' && (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="token1Amount">Token 1 (required)</Label>
                                    <TokenAmountInput id="token1Amount" amount={amount1} onAmountChange={setAmount1} tokens={tokenOptions} token={token1} onTokenChange={setToken1} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="token2Amount">Token 2 (optional)</Label>
                                    <TokenAmountInput id="token2Amount" amount={amount2} onAmountChange={setAmount2} tokens={tokenOptions} token={token2} onTokenChange={setToken2} />
                                </div>
                            </div>
                            {variants.length === 0 && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="stock">Stock (blank = unlimited)</Label>
                                    <Input id="stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Options (size / color, optional)</Label>
                                    <Button type="button" size="sm" variant="outline" onClick={addVariant}>
                                        Add option
                                    </Button>
                                </div>
                                {variants.map((v, i) => (
                                    <div key={v.id ?? `new-${i}`} className="flex items-center gap-2">
                                        <Input placeholder="Label, e.g. Size L / Black" value={v.label} onChange={(e) => updateVariant(i, { label: e.target.value })} />
                                        <Input placeholder="SKU" className="w-28" value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} />
                                        <Input placeholder="Stock" type="number" min="0" className="w-24" value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} />
                                        <Button type="button" size="sm" variant="ghost" onClick={() => removeVariant(i)}>
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Separator />
                        </>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="maxPerWallet">Max redemptions per wallet (blank = unlimited)</Label>
                        <Input id="maxPerWallet" type="number" min="1" className="max-w-40" value={maxPerWallet} onChange={(e) => setMaxPerWallet(e.target.value)} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="publishAt">Publish date</Label>
                            <DateTimePicker id="publishAt" value={publishAt} onChange={setPublishAt} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="redeemStartAt">Redeem starts</Label>
                            <DateTimePicker id="redeemStartAt" value={redeemStartAt} onChange={setRedeemStartAt} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="redeemEndAt">Redeem ends</Label>
                            <DateTimePicker id="redeemEndAt" value={redeemEndAt} onChange={setRedeemEndAt} />
                        </div>
                    </div>

                    <Button className="w-full" disabled={incomplete || update.isPending} isLoading={update.isPending} loadingText="Saving…" onClick={submit}>
                        Save changes
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
