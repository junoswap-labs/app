'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { formatUnits } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { DeadlineCountdown } from '@/components/rwa/ship-deadline-countdown'
import { QrSharePanel } from '@/components/airdrop/qr-share-panel'
import { LocationGate } from '@/components/airdrop/location-gate'
import { LiveClaimFeed } from '@/components/airdrop/live-claim-feed'
import { ClaimReveal } from '@/components/airdrop/claim-reveal'
import { AirdropStatusPill } from '@/components/airdrop/campaign-card'
import { ReportButton } from '@/components/airdrop/report-button'
import { TxProgressDialog } from '@/components/airdrop/tx-progress'
import { ArrowLeft, Clock3, Share2, ShieldAlert, Users } from 'lucide-react'
import Link from 'next/link'
import { useAirdropCampaign, useAirdropClaims } from '@/hooks/useAirdropCampaigns'
import { useClaimAirdrop } from '@/hooks/useAirdropActions'
import { campaignShareHash } from '@/lib/onchain/airdrop-share'
import { findPaymentToken } from '@/lib/tokens'
import { getExplorerTokenUrl } from '@/lib/explorer'
import { toastError } from '@/lib/toast'

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1.5 truncate text-sm font-medium">{children}</p>
        </div>
    )
}

/** The claim UI itself — shared by app/app/airdrop/[campaignId]/page.tsx and
 *  app/app/airdrop/s/[shareHash]/page.tsx (which resolves a share link to a campaignId first).
 *  The Share panel always builds the hashed link (never the raw campaignId), regardless of which
 *  of those two routes the visitor is currently on. */
export function AirdropClaimPageContent({ campaignId }: { campaignId: string }) {
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
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
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        )
    }
    if (!campaign) {
        return (
            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <EmptyState title="Airdrop not found" description="This link may be invalid, or the campaign hasn't been indexed yet — try again in a moment." />
            </div>
        )
    }

    const isActive = campaign.status === 'active' && (!campaign.expires_at || new Date(campaign.expires_at).getTime() > Date.now())
    const needsLocation = campaign.location_restricted && !gps
    const validRecipient = ADDRESS_RE.test(recipient)
    const canClaim = isConnected && isActive && validRecipient && !needsLocation && !myClaim && !claimedFor

    // The amount is only decided once the tx is broadcast, so the slot-machine roll starts at
    // `pending` — never while the wallet popup is still open. Relayer-mode claims have no wallet
    // step at all: /api/airdrop/claim signs, sends and waits, so its whole `checking` leg is the wait.
    const rolling =
        claimAirdrop.phase === 'pending' || (campaign.gas_mode === 'relayer' && claimAirdrop.phase === 'checking')
    const revealing = Boolean(myClaim || claimedFor || rolling)

    const claim = async () => {
        if (!validRecipient) return
        try {
            await claimAirdrop.claimAsync({
                campaignId: campaignId as `0x${string}`,
                recipient: recipient as `0x${string}`,
                gps: gps ?? undefined,
            })
            setClaimedFor(recipient)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Claim failed')
        }
    }

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
            <Link href="/app/airdrop" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to airdrops
            </Link>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
                <div className="min-w-0 space-y-6">
                    {campaign.cover_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={campaign.cover_image_url}
                            alt={campaign.title ?? 'Airdrop'}
                            className="aspect-[2/1] w-full rounded-xl border object-cover"
                        />
                    )}

                    <div className="flex items-start justify-between gap-4">
                        <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{campaign.title ?? 'Airdrop'}</h1>
                        <div className="flex shrink-0 items-center gap-1">
                            <ReportButton subjectType="airdrop_campaign" subjectId={campaign.id} />
                            <AirdropStatusPill status={campaign.status} className="mt-1" />
                        </div>
                    </div>
                    {campaign.description && <p className="text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{campaign.description}</p>}

                    {/* Anyone can run a campaign with any ERC20 — a claimant has no way to tell a
                        real token from a lookalike by name alone, so say so out loud unless the
                        address is one of the tokens we actually verified (lib/tokens.ts). */}
                    {!findPaymentToken(chainId, campaign.token) && (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs sm:text-sm">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                            <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">Unverified token.</span> This airdrop pays out a
                                token that has not been verified by Junoswap. Check the contract before you claim or trade it —{' '}
                                <a
                                    href={getExplorerTokenUrl(chainId, campaign.token)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono underline underline-offset-2"
                                >
                                    {campaign.token.slice(0, 10)}…{campaign.token.slice(-6)}
                                </a>
                            </p>
                        </div>
                    )}

                    <Card className="overflow-hidden">
                        {/* gap-px over the border colour draws the hairline grid — every child has to be a
                            direct grid item carrying its own bg-card or the seams break. */}
                        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                            <Stat label="Available">
                                <span className="tabular-nums">{formatUnits(BigInt(campaign.remaining_amount), decimals)}</span>
                                <span className="ml-1 text-xs text-muted-foreground">{symbol}</span>
                            </Stat>
                            <Stat label="Type">{campaign.amount_mode === 'fixed' ? 'Fixed' : 'Random'}</Stat>
                            <Stat label="Claimed">
                                <span className="inline-flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="tabular-nums">
                                        {campaign.claimed_count}
                                        {campaign.max_claimants ? ` / ${campaign.max_claimants}` : ''}
                                    </span>
                                </span>
                            </Stat>
                            <Stat label="Network fee">{campaign.gas_mode === 'relayer' ? 'Covered' : 'Self-paid'}</Stat>
                        </div>
                        {campaign.expires_at && (
                            <div className="flex items-center gap-2 border-t p-4 text-sm">
                                <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <DeadlineCountdown deadline={new Date(campaign.expires_at).getTime()} label="Expires" />
                            </div>
                        )}
                    </Card>

                    <Card>
                        <CardHeader className="p-5 pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Recent claims</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 pt-0">
                            <LiveClaimFeed campaignId={campaignId} decimals={decimals} symbol={symbol} />
                        </CardContent>
                    </Card>
                </div>

                <div className="min-w-0 space-y-4 lg:sticky lg:top-6">
                    <Card>
                        <CardHeader className="p-5 pb-3">
                            <CardTitle className="text-base">Claim your tokens</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-5 pt-0">
                            {revealing ? (
                                <div className="flex flex-col items-center gap-3 py-4">
                                    <ClaimReveal amount={myClaim ? Number(formatUnits(BigInt(myClaim.amount), decimals)) : null} symbol={symbol} />
                                    {myClaim ? (
                                        <p className="text-sm text-positive">Sent to your wallet</p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Confirming on-chain…</p>
                                    )}
                                </div>
                            ) : !isActive ? (
                                <p className="text-sm text-muted-foreground">This airdrop is no longer active.</p>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                            <Label htmlFor="recipient">Receiving address</Label>
                                            <button
                                                type="button"
                                                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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
                                        size="lg"
                                        disabled={!canClaim || claimAirdrop.isPending}
                                        isLoading={claimAirdrop.isPending}
                                        loadingText="Claiming…"
                                        onClick={claim}
                                    >
                                        {!isConnected ? 'Connect wallet to claim' : 'Claim'}
                                    </Button>
                                    <p className="text-center text-xs text-muted-foreground">Secured on-chain by the airdrop contract</p>
                                    <TxProgressDialog phase={claimAirdrop.phase} />
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="p-5 pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Share2 className="h-4 w-4" /> Share this airdrop
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 pt-0">
                            <QrSharePanel url={shareUrl} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
