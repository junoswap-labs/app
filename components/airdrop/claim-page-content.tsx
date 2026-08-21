'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DeadlineCountdown } from '@/components/rwa/ship-deadline-countdown'
import { QrSharePanel } from '@/components/airdrop/qr-share-panel'
import { LocationGate } from '@/components/airdrop/location-gate'
import { LiveClaimFeed } from '@/components/airdrop/live-claim-feed'
import { ClaimReveal } from '@/components/airdrop/claim-reveal'
import { ArrowLeft, Check, Clock3, MapPin, Share2, ShieldCheck, Users } from 'lucide-react'
import Link from 'next/link'
import { useAirdropCampaign, useAirdropClaims } from '@/hooks/useAirdropCampaigns'
import { useClaimAirdrop } from '@/hooks/useAirdropActions'
import { campaignShareHash } from '@/lib/onchain/airdrop-share'
import { toastError } from '@/lib/toast'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/** The claim UI itself — shared by app/app/airdrop/[campaignId]/page.tsx and
 *  app/app/airdrop/s/[shareHash]/page.tsx (which resolves a share link to a campaignId first).
 *  The Share panel always builds the hashed link (never the raw campaignId), regardless of which
 *  of those two routes the visitor is currently on. */
export function AirdropClaimPageContent({ campaignId }: { campaignId: string }) {
    const { address, isConnected } = useAccount()
    const { data: campaign, isLoading } = useAirdropCampaign(campaignId)
    const { data: claims } = useAirdropClaims(campaignId)
    const claimAirdrop = useClaimAirdrop()

    const [recipient, setRecipient] = useState('')
    const [useManualAddress, setUseManualAddress] = useState(false)
    const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
    const [claimedFor, setClaimedFor] = useState<string | null>(null)
    const [shareUrl, setShareUrl] = useState('')

    useEffect(() => {
        if (!useManualAddress && address) setRecipient(address)
    }, [address, useManualAddress])

    useEffect(() => {
        setShareUrl(`${window.location.origin}/app/airdrop/s/${campaignShareHash(campaignId as `0x${string}`)}`)
    }, [campaignId])

    const decimals = campaign?.token_decimals ?? 18
    const symbol = campaign?.token_symbol ?? ''

    const myClaim = useMemo(
        () =>
            claimedFor ? claims?.find((c) => c.recipient_wallet.toLowerCase() === claimedFor.toLowerCase()) : undefined,
        [claims, claimedFor]
    )

    if (isLoading) {
        return (
            <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        )
    }
    if (!campaign) {
        return (
            <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
                <EmptyState title="Airdrop not found" description="This link may be invalid, or the campaign hasn't been indexed yet — try again in a moment." />
            </div>
        )
    }

    const isActive = campaign.status === 'active' && (!campaign.expires_at || new Date(campaign.expires_at).getTime() > Date.now())
    const needsLocation = campaign.location_restricted && !gps
    const validRecipient = ADDRESS_RE.test(recipient)
    const canClaim = isConnected && isActive && validRecipient && !needsLocation && !myClaim && !claimedFor

    const claim = async () => {
        if (!validRecipient) return
        setClaimedFor(recipient)
        try {
            await claimAirdrop.claimAsync({
                campaignId: campaignId as `0x${string}`,
                recipient: recipient as `0x${string}`,
                gps: gps ?? undefined,
            })
        } catch (err) {
            setClaimedFor(null)
            toastError(err instanceof Error ? err.message : 'Claim failed')
        }
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
            <Link href="/app/airdrop" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to airdrops</Link>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
                <div className="space-y-6">
            {campaign.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={campaign.cover_image_url}
                    alt={campaign.title ?? 'Airdrop'}
                    className="aspect-[2/1] w-full rounded-2xl border object-cover"
                />
            )}

            <div className="flex items-start justify-between gap-4">
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Token giveaway</p><h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{campaign.title ?? 'Airdrop'}</h1></div>
                <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>{campaign.status}</Badge>
            </div>
            {campaign.description && <p className="max-w-2xl text-base leading-7 text-muted-foreground">{campaign.description}</p>}

            <Card className="overflow-hidden">
                <CardContent className="grid grid-cols-2 gap-px bg-border p-0 text-sm sm:grid-cols-4">
                    <div className="bg-card p-4"><p className="text-muted-foreground">Available</p><p className="mt-2 text-lg font-semibold tabular-nums">{formatUnits(BigInt(campaign.remaining_amount), decimals)} <span className="text-xs">{symbol}</span></p></div>
                    <div>
                        <div className="bg-card p-4"><p className="text-muted-foreground">Type</p><p className="mt-2 font-medium">{campaign.amount_mode === 'fixed' ? 'Fixed' : 'Random'}</p></div>
                    </div>
                    <div className="bg-card p-4"><p className="text-muted-foreground">Claimed</p><p className="mt-2 inline-flex items-center gap-1.5 font-medium"><Users className="h-4 w-4 text-muted-foreground" />
                            {campaign.claimed_count}
                            {campaign.max_claimants ? ` / ${campaign.max_claimants}` : ' (unlimited)'}
                        </p></div>
                    <div className="bg-card p-4"><p className="text-muted-foreground">Network fee</p><p className="mt-2 font-medium">{campaign.gas_mode === 'relayer' ? 'Covered' : 'Self-paid'}</p></div>
                </CardContent>
                {campaign.expires_at && (
                    <CardContent className="flex items-center gap-2 border-t p-4 text-sm">
                        <Clock3 className="h-4 w-4 text-muted-foreground" />
                        <DeadlineCountdown deadline={new Date(campaign.expires_at).getTime()} label="Expires" />
                    </CardContent>
                )}
            </Card>

            <div className="lg:sticky lg:top-6">
            <Card className="border-foreground/15 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5" /> Claim your tokens</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {myClaim || claimedFor ? (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <ClaimReveal amount={myClaim ? Number(formatUnits(BigInt(myClaim.amount), decimals)) : null} symbol={symbol} />
                            {myClaim && <p className="text-sm text-positive">Sent to your wallet</p>}
                        </div>
                    ) : !isActive ? (
                        <p className="text-sm text-muted-foreground">This airdrop is no longer active.</p>
                    ) : (
                        <>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="recipient">Receiving address</Label>
                                    <button
                                        type="button"
                                        className="text-xs text-primary underline-offset-4 hover:underline"
                                        onClick={() => setUseManualAddress((v) => !v)}
                                    >
                                        {useManualAddress ? 'Use connected wallet' : 'Send to a different address'}
                                    </button>
                                </div>
                                {useManualAddress ? (
                                    <Input id="recipient" placeholder="0x…" value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} />
                                ) : (
                                    <Input id="recipient" value={recipient} disabled placeholder="Connect your wallet" />
                                )}
                                <p className="text-xs text-muted-foreground">
                                    You still need to connect a wallet to claim — this only changes where the tokens are sent.
                                </p>
                            </div>

                            {campaign.location_restricted && (
                                <LocationGate radiusM={campaign.location_radius_m ?? 0} onLocation={(lat, lng) => setGps({ lat, lng })} />
                            )}

                            <Button
                                className="w-full"
                                size="xl"
                                disabled={!canClaim || claimAirdrop.isPending}
                                isLoading={claimAirdrop.isPending}
                                loadingText="Claiming…"
                                onClick={claim}
                            >
                                {!isConnected ? 'Connect wallet to claim' : 'Claim'}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> Secure claim powered by smart contract</div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Share2 className="h-4 w-4" /> Share this airdrop</CardTitle>
                </CardHeader>
                <CardContent>
                    <QrSharePanel url={shareUrl} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Recent claims</CardTitle>
                </CardHeader>
                <CardContent>
                    <LiveClaimFeed campaignId={campaignId} decimals={decimals} symbol={symbol} />
                </CardContent>
            </Card>
                </div>
            </div>
        </div>
    )
}
