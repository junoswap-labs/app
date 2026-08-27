'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import type { Address } from 'viem'
import { ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { ExplorerLink } from '@/components/ui/explorer-link'
import { ListedBy } from '@/components/redeem/listed-by'
import { RedemptionStatusTracker } from '@/components/redeem/redemption-status-tracker'
import { useRedeemItem } from '@/hooks/useRedeemItems'
import { useListerProfiles } from '@/hooks/useListerProfile'
import { useMyRedeemOrders, useRedeemOrderLogs } from '@/hooks/useRedeemOrders'
import { useCreateRedeemOrder } from '@/hooks/useCreateRedeemOrder'
import { useJunoPtsBalance } from '@/hooks/useJunoPtsBalance'
import { erc20Abi } from '@/lib/abis/erc20'
import { redeemPriceLabel, redeemLogLabel } from '@/lib/redeem-format'
import { getSavedShipping, saveShipping } from '@/lib/redeem-shipping-storage'
import { DEFAULT_SHIPPING, ShippingAddressForm, isShippingComplete } from '@/components/redeem/shipping-address-form'
import { JUNO_PTS_DECIMALS } from '@/types/redeem'
import { toastSuccess, toastError } from '@/lib/toast'
import type { ShippingInfo } from '@/types/redeem'

export default function RedeemItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
    const { itemId } = use(params)
    const { address, isConnected } = useAccount()
    const chainId = useChainId()

    const { data: item, isLoading } = useRedeemItem(itemId)
    const { data: listerProfiles } = useListerProfiles(item ? [item.lister_wallet] : [])
    const { data: pointBalance } = useJunoPtsBalance()
    const { data: myOrders } = useMyRedeemOrders()
    const createOrder = useCreateRedeemOrder()

    const [variantId, setVariantId] = useState<number | undefined>(undefined)
    const savedShipping = useMemo(() => getSavedShipping(), [])
    const [shipping, setShipping] = useState<ShippingInfo>(savedShipping ?? DEFAULT_SHIPPING)
    const [rememberAddress, setRememberAddress] = useState(Boolean(savedShipping))

    const { data: tokenBalance } = useReadContract({
        address: item?.payment_token as Address | undefined,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: Boolean(item?.payment_token && address) },
    })

    const myOrderForItem = myOrders?.find((o) => o.item_id === item?.id)
    // Same "past PendingPayment" definition the server enforces in app/api/redeem/orders/route.ts —
    // an abandoned/wallet-rejected attempt doesn't count against the cap.
    const myRedeemCount = myOrders?.filter((o) => o.item_id === item?.id && o.status !== 'PendingPayment').length ?? 0
    const { data: logs } = useRedeemOrderLogs(myOrderForItem?.id)

    if (isLoading) return null

    if (!item) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Item not found"
                    description="This Redeem item doesn't exist or is no longer published."
                    action={
                        <Button asChild variant="outline">
                            <Link href="/app/redeem">Back to Redeem</Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    const listerProfile = listerProfiles?.[item.lister_wallet]
    const now = Date.now()
    const notOpenYet = item.redeem_start_at && now < new Date(item.redeem_start_at).getTime()
    const closed = item.redeem_end_at && now > new Date(item.redeem_end_at).getTime()
    const hasVariants = (item.variants?.length ?? 0) > 0
    const selectedVariant = item.variants?.find((v) => v.id === variantId)
    const outOfStock = hasVariants ? selectedVariant?.stock === 0 : item.stock === 0

    const insufficientPoints = pointBalance != null && BigInt(item.price_points) > pointBalance
    const insufficientToken =
        item.payment_token && item.payment_amount != null && tokenBalance != null && BigInt(item.payment_amount) > tokenBalance

    const needsShipping = item.kind === 'merch'
    const shippingIncomplete = needsShipping && !isShippingComplete(shipping)
    const needsVariant = hasVariants && variantId == null

    // UX only, mirrors RwaEscrow.fund()'s `require(seller != msg.sender, "self trade")` — the
    // contract is what actually enforces it (a mismatched wallet's tx would just revert), this only
    // saves a doomed on-chain attempt. Only meaningful for merch/registered: that's the only case
    // where payout_wallet IS the on-chain `seller` param (official items settle through the
    // treasury, not the lister, and NFT kind has no such contract-level guard at all).
    const isSelfTrade =
        item.kind === 'merch' && item.tier === 'registered' && Boolean(item.payout_wallet) && Boolean(address) &&
        item.payout_wallet!.toLowerCase() === address!.toLowerCase()

    const atWalletLimit = item.max_per_wallet != null && myRedeemCount >= item.max_per_wallet

    const disabled =
        Boolean(notOpenYet) ||
        Boolean(closed) ||
        Boolean(outOfStock) ||
        Boolean(insufficientPoints) ||
        Boolean(insufficientToken) ||
        shippingIncomplete ||
        needsVariant ||
        isSelfTrade ||
        atWalletLimit ||
        createOrder.isPending

    const redeem = async () => {
        if (!isConnected) {
            toastError('Please connect your wallet first')
            return
        }
        try {
            await createOrder.mutateAsync({ itemId: item.id, variantId, shipping: needsShipping ? shipping : undefined })
            if (needsShipping) {
                if (rememberAddress) saveShipping(shipping)
            }
            toastSuccess(item.kind === 'nft' ? 'Redeemed — the NFT will arrive in your wallet shortly' : 'Redeemed — track it below')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Redeem failed')
        }
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <Breadcrumb items={[{ label: 'Redeem', href: '/app/redeem' }, { label: item.name }]} />

            {/* Gallery and everything the buyer reads on the left; the compact buy panel sticks to
                the right. The shipping form belongs on the wide side — squeezed into the panel rail
                its three-across fields collapse into unreadable slivers. */}
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
                <div className="min-w-0 space-y-6">
                    <div className="space-y-2">
                        <div className="overflow-hidden rounded-xl border bg-muted">
                            {item.image_urls[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.image_urls[0]} alt={item.name} className="aspect-square h-full w-full object-cover" />
                            ) : (
                                <div className="flex aspect-square items-center justify-center text-muted-foreground">
                                    <ImageOff className="h-8 w-8" />
                                </div>
                            )}
                        </div>
                        {item.image_urls.length > 1 && (
                            <div className="flex gap-2">
                                {item.image_urls.slice(1).map((url) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={url} src={url} alt="" className="h-16 w-16 rounded-md border object-cover" />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h1 className="text-3xl font-semibold tracking-[-0.03em]">{item.name}</h1>
                        <ListedBy tier={item.tier} listerWallet={item.lister_wallet} profile={listerProfile} />
                        <p className="text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{item.description}</p>
                        {item.thailand_only && (
                            <p className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-muted-foreground">
                                Ships within Thailand only
                            </p>
                        )}
                    </div>

                    {needsShipping && (
                        <Card>
                            <CardContent className="space-y-3 p-5">
                                <ShippingAddressForm value={shipping} onChange={setShipping} thailandOnly={item.thailand_only} />
                                <div className="flex items-center gap-2">
                                    <Switch id="remember" checked={rememberAddress} onCheckedChange={setRememberAddress} />
                                    <Label htmlFor="remember" className="text-xs font-normal text-muted-foreground">
                                        Save this address on this device
                                    </Label>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4 lg:sticky lg:top-20">
                    <Card>
                        <CardContent className="space-y-4 p-5">
                            <div className="text-2xl font-semibold tabular-nums">
                                {redeemPriceLabel(item, chainId, item.payment_token)}
                            </div>

                            {pointBalance != null && (
                                <p className="text-xs text-muted-foreground">
                                    Your balance: {Number(formatUnits(pointBalance, JUNO_PTS_DECIMALS)).toLocaleString()} PTS
                                </p>
                            )}

                            {hasVariants && (
                                <div className="space-y-1.5">
                                    <Label>Options</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {item.variants?.map((v) => (
                                            <Button
                                                key={v.id}
                                                type="button"
                                                size="sm"
                                                variant={variantId === v.id ? 'secondary' : 'outline'}
                                                disabled={v.stock === 0}
                                                onClick={() => setVariantId(v.id)}
                                            >
                                                {v.label}
                                                {v.stock === 0 ? ' (out of stock)' : v.stock !== null ? ` (${v.stock} left)` : ''}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!hasVariants && item.stock !== null && <p className="text-xs text-muted-foreground">{item.stock} left</p>}

                            {notOpenYet && (
                                <p className="text-xs text-muted-foreground">
                                    Redeeming opens {new Date(item.redeem_start_at!).toLocaleString()}.
                                </p>
                            )}
                            {closed && <p className="text-xs text-destructive">The redeem window for this item has closed.</p>}
                            {insufficientPoints && <p className="text-xs text-destructive">Not enough Points.</p>}
                            {insufficientToken && <p className="text-xs text-destructive">Not enough {item.payment_token_symbol}.</p>}
                            {needsShipping && shippingIncomplete && (
                                <p className="text-xs text-muted-foreground">Fill in the shipping address to continue.</p>
                            )}
                            {isSelfTrade && <p className="text-xs text-destructive">You listed this item — you can&apos;t redeem your own listing.</p>}
                            {atWalletLimit && (
                                <p className="text-xs text-destructive">
                                    You&apos;ve already redeemed this item {item.max_per_wallet} {item.max_per_wallet === 1 ? 'time' : 'times'} — that&apos;s the limit per wallet.
                                </p>
                            )}

                            <Button className="w-full" disabled={disabled} isLoading={createOrder.isPending} loadingText="Redeeming…" onClick={redeem}>
                                {outOfStock ? 'Sold out' : isSelfTrade ? "Can't redeem your own listing" : atWalletLimit ? 'Limit reached' : 'Redeem'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Full-width bottom bar rather than squeezed into the 380px sidebar rail — the status
                tracker's steps need real horizontal room, especially the 4-step merch flow. */}
            {myOrderForItem && (
                <Card className="mt-8">
                    <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Your redemption</p>
                            {myOrderForItem.tracking_number && (
                                <p className="text-xs text-muted-foreground">Tracking: {myOrderForItem.tracking_number}</p>
                            )}
                        </div>
                        <RedemptionStatusTracker status={myOrderForItem.status} kind={myOrderForItem.kind} />
                    </CardContent>
                    {Array.isArray(logs) && logs.length > 0 && (
                        <CardContent className="grid gap-x-6 gap-y-1 border-t p-5 pt-4 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                            {logs.map((log: { id: string; action: string; created_at: string; tx_hash: string | null }) => (
                                <div key={log.id} className="flex justify-between gap-2">
                                    <span>{redeemLogLabel(log.action)}</span>
                                    <span className="flex items-center gap-2">
                                        {log.tx_hash && (
                                            <ExplorerLink value={log.tx_hash} type="tx" chainId={chainId} compact startChars={6} endChars={4} />
                                        )}
                                        {new Date(log.created_at).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}
        </div>
    )
}
