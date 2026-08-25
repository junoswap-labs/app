'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAccount, useChainId } from 'wagmi'
import { parseUnits } from 'viem'
import { Plus } from 'lucide-react'
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
import { NftFields } from '@/components/redeem/nft-fields'
import { MerchFields, type VariantRow } from '@/components/redeem/merch-fields'
import { useIsAdmin, useIsPartnerRedeem } from '@/hooks/useOnChainRoles'
import { useCreateRedeemItem } from '@/hooks/useCreateRedeemItem'
import { getPaymentTokens } from '@/lib/tokens'
import { toastSuccess, toastError } from '@/lib/toast'
import { JUNO_PTS_DECIMALS } from '@/types/redeem'
import type { RedeemKind, RedeemTier } from '@/types/redeem'
import { getContractAddresses } from '@/config/contract-addresses'

export default function ListRedeemItemPage() {
    const router = useRouter()
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const isAdmin = useIsAdmin()
    const isPartnerRedeem = useIsPartnerRedeem()
    const { junoPts: JUNO_PTS_ADDRESS } = getContractAddresses(chainId)
    const paymentTokens = getPaymentTokens(chainId)
    // JunoPts shows up as an ordinary option in both token pickers (rather than a separate,
    // hardcoded "Points price" field) so either leg can be Points, an ERC20, or left unset.
    const pointsOption = JUNO_PTS_ADDRESS ? [{ symbol: 'PTS', address: JUNO_PTS_ADDRESS, decimals: JUNO_PTS_DECIMALS }] : []
    const tokenOptions = [...pointsOption, ...paymentTokens]
    const createItem = useCreateRedeemItem()

    const [tier, setTier] = useState<RedeemTier>(isAdmin ? 'official' : 'registered')
    const [kind, setKind] = useState<RedeemKind>('merch')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [imageUrls, setImageUrls] = useState<(string | null)[]>([null])
    const [amount1, setAmount1] = useState('')
    const [token1, setToken1] = useState<SelectedToken | null>(pointsOption[0] ?? tokenOptions[0] ?? null)
    const [amount2, setAmount2] = useState('')
    const [token2, setToken2] = useState<SelectedToken | null>(null)
    const [nftContract, setNftContract] = useState('')
    const [nftTokenId, setNftTokenId] = useState('')
    const [stock, setStock] = useState('')
    const [thailandOnly, setThailandOnly] = useState(false)
    const [maxPerWallet, setMaxPerWallet] = useState('')
    const [variants, setVariants] = useState<VariantRow[]>([])
    const [publishAt, setPublishAt] = useState('')
    const [redeemStartAt, setRedeemStartAt] = useState('')
    const [redeemEndAt, setRedeemEndAt] = useState('')

    const canOfficial = isAdmin
    const canRegistered = isPartnerRedeem

    const isPoints = (t: SelectedToken | null) => Boolean(t?.address && JUNO_PTS_ADDRESS && t.address.toLowerCase() === JUNO_PTS_ADDRESS.toLowerCase())
    // Exactly one on-chain leg can be escrowed (RwaEscrow.fund() takes a single paymentToken +
    // amount) — Points is settled separately, never through the escrow. So whichever of the two
    // legs is Points maps to price_points; the other (if any) is the escrowed ERC20 leg. If
    // neither leg is Points, leg 1 is the escrowed one and leg 2 is ignored on submit.
    const pointsLeg = isPoints(token1) ? { token: token1, amount: amount1 } : isPoints(token2) ? { token: token2, amount: amount2 } : null
    const tokenLeg = !isPoints(token1) && token1 ? { token: token1, amount: amount1 } : !isPoints(token2) && token2 ? { token: token2, amount: amount2 } : null

    const publishDate = publishAt ? new Date(publishAt) : null
    const redeemStartDate = redeemStartAt ? new Date(redeemStartAt) : null
    const redeemEndDate = redeemEndAt ? new Date(redeemEndAt) : null
    const publishInPast = Boolean(publishDate && publishDate < new Date())
    const redeemStartBeforePublish = Boolean(publishDate && redeemStartDate && redeemStartDate < publishDate)
    const redeemEndBeforeStart = Boolean(redeemStartDate && redeemEndDate && redeemEndDate < redeemStartDate)
    const dateOrderInvalid = publishInPast || redeemStartBeforePublish || redeemEndBeforeStart

    if (!isConnected) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState title="Connect your wallet" description="Listing a Redeem item is tied to your wallet address." />
            </div>
        )
    }

    if (!canOfficial && !canRegistered) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <h2 className="text-lg font-semibold tracking-tight">Redeem partner rights required</h2>
                        <p className="max-w-md text-sm text-muted-foreground">
                            Creating an Official listing requires the Admin role; a Registered listing requires an
                            approved Partner (Redeem) application.
                        </p>
                        <Button asChild className="mt-1">
                            <Link href="/app/partner/apply">Apply as a Redeem partner</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const effectiveTier: RedeemTier = tier === 'official' && !canOfficial ? 'registered' : tier === 'registered' && !canRegistered ? 'official' : tier

    const incomplete =
        !name.trim() ||
        !description.trim() ||
        (kind === 'merch' &&
            (!token1?.address?.trim() ||
                !Number(amount1) ||
                (Boolean(token2?.address) && !Number(amount2)) ||
                !tokenLeg)) ||
        (kind === 'nft' && (!nftContract.trim() || !nftTokenId.trim())) ||
        dateOrderInvalid

    const addVariant = () => setVariants((v) => [...v, { label: '', sku: '', stock: '' }])
    const updateVariant = (i: number, patch: Partial<VariantRow>) =>
        setVariants((v) => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
    const removeVariant = (i: number) => setVariants((v) => v.filter((_, idx) => idx !== i))

    const submit = async () => {
        try {
            await createItem.mutateAsync({
                tier: effectiveTier,
                kind,
                name: name.trim(),
                description: description.trim(),
                image_urls: imageUrls.filter((u): u is string => Boolean(u)),
                price_points:
                    pointsLeg?.token && pointsLeg.amount ? parseUnits(pointsLeg.amount, pointsLeg.token.decimals).toString() : '0',
                payment_token: tokenLeg?.token?.address,
                payment_token_symbol: tokenLeg?.token?.symbol,
                payment_amount:
                    tokenLeg?.token && tokenLeg.amount ? parseUnits(tokenLeg.amount, tokenLeg.token.decimals).toString() : undefined,
                payout_wallet: effectiveTier === 'registered' ? address : undefined,
                nft_contract: kind === 'nft' ? nftContract.trim() : undefined,
                nft_token_id: kind === 'nft' ? nftTokenId.trim() : undefined,
                stock: kind === 'merch' && variants.length === 0 && stock ? Number(stock) : null,
                thailand_only: kind === 'merch' && thailandOnly,
                max_per_wallet: maxPerWallet ? Number(maxPerWallet) : null,
                variants:
                    kind === 'merch' && variants.length > 0
                        ? variants
                              .filter((v) => v.label.trim())
                              .map((v) => ({ label: v.label.trim(), sku: v.sku.trim() || undefined, stock: v.stock ? Number(v.stock) : null }))
                        : undefined,
                publish_at: publishAt ? new Date(publishAt).toISOString() : undefined,
                redeem_start_at: redeemStartAt ? new Date(redeemStartAt).toISOString() : undefined,
                redeem_end_at: redeemEndAt ? new Date(redeemEndAt).toISOString() : undefined,
            })
            toastSuccess('Redeem item listed')
            router.push('/app/redeem')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Listing failed')
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <Breadcrumb items={[{ label: 'Redeem', href: '/app/redeem' }, { label: 'List item' }]} />
            <h1 className="text-2xl font-semibold tracking-tight">List a Redeem Item</h1>

            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-1.5">
                        <Label>Tier</Label>
                        <div className="flex gap-1">
                            {canOfficial && (
                                <Button type="button" size="sm" variant={effectiveTier === 'official' ? 'secondary' : 'outline'} onClick={() => setTier('official')}>
                                    Official
                                </Button>
                            )}
                            {canRegistered && (
                                <Button type="button" size="sm" variant={effectiveTier === 'registered' ? 'secondary' : 'outline'} onClick={() => setTier('registered')}>
                                    Registered
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* STEP 1.1 */}
                    <div className="space-y-1.5">
                        <Label>Type</Label>
                        <div className="flex gap-1">
                            <Button type="button" size="sm" variant={kind === 'merch' ? 'secondary' : 'outline'} onClick={() => setKind('merch')}>
                                RWA / Merch
                            </Button>
                            <Button type="button" size="sm" variant={kind === 'nft' ? 'secondary' : 'outline'} onClick={() => setKind('nft')}>
                                NFT
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Item details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                            {imageUrls.length < 3 && (
                                <div className="space-y-1.5">
                                    <span className="text-sm font-medium leading-none text-transparent select-none">Add</span>
                                    <button
                                        type="button"
                                        onClick={() => setImageUrls((prev) => [...prev, null])}
                                        aria-label="Add another photo slot"
                                        className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">The first photo is used as the catalog thumbnail.</p>
                    </div>

                    <Separator />

                    {/* STEP 1.2.1 */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="token1Amount">Token 1 (required)</Label>
                            <TokenAmountInput
                                id="token1Amount"
                                amount={amount1}
                                onAmountChange={setAmount1}
                                tokens={tokenOptions}
                                token={token1}
                                onTokenChange={setToken1}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="token2Amount">Token 2 (optional)</Label>
                            <TokenAmountInput
                                id="token2Amount"
                                amount={amount2}
                                onAmountChange={setAmount2}
                                tokens={tokenOptions}
                                token={token2}
                                onTokenChange={setToken2}
                            />
                        </div>
                    </div>
                    {kind === 'merch' && !tokenLeg ? (
                        <p className="text-xs text-destructive">
                            One of Token 1 / Token 2 must be a non-Points ERC20 — RwaEscrow only ever escrows a single
                            token amount on redeem, so a purchase can&apos;t complete on a Points-only listing yet.
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Either slot can be Points (PTS) or an ERC20 — only one non-Points token is escrowed
                            on-chain per listing, so if both are non-Points, Token 2 is ignored.
                        </p>
                    )}

                    {/* STEP 1.2.2 */}
                    {kind === 'nft' ? (
                        <NftFields
                            tier={effectiveTier}
                            nftContract={nftContract}
                            nftTokenId={nftTokenId}
                            setNftContract={setNftContract}
                            setNftTokenId={setNftTokenId}
                        />
                    ) : (
                        <MerchFields
                            stock={stock}
                            setStock={setStock}
                            thailandOnly={thailandOnly}
                            setThailandOnly={setThailandOnly}
                            variants={variants}
                            addVariant={addVariant}
                            updateVariant={updateVariant}
                            removeVariant={removeVariant}
                        />
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="maxPerWallet">Max redemptions per wallet (blank = unlimited)</Label>
                        <Input id="maxPerWallet" type="number" min="1" className="max-w-40" value={maxPerWallet} onChange={(e) => setMaxPerWallet(e.target.value)} />
                    </div>

                    <Separator />

                    {/* STEP 1.3 */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="publishAt">Publish date</Label>
                            <DateTimePicker id="publishAt" value={publishAt} onChange={setPublishAt} minDate={new Date()} />
                            {publishInPast && <p className="text-xs text-destructive">Can&apos;t publish in the past.</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="redeemStartAt">Redeem starts</Label>
                            <DateTimePicker id="redeemStartAt" value={redeemStartAt} onChange={setRedeemStartAt} minDate={publishDate ?? undefined} />
                            {redeemStartBeforePublish && <p className="text-xs text-destructive">Can&apos;t start before the publish date.</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="redeemEndAt">Redeem ends</Label>
                            <DateTimePicker id="redeemEndAt" value={redeemEndAt} onChange={setRedeemEndAt} minDate={redeemStartDate ?? undefined} />
                            {redeemEndBeforeStart && <p className="text-xs text-destructive">Can&apos;t end before redeem starts.</p>}
                        </div>
                    </div>

                    <Button className="w-full" disabled={incomplete || createItem.isPending} isLoading={createItem.isPending} loadingText="Listing…" onClick={submit}>
                        List item
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
