'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAccount, usePublicClient, useReadContracts } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import type { Address } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { ImageUploadField } from '@/components/ui/image-upload'
import { erc20Abi } from '@/lib/abis/erc20'

// Leaflet touches `window` at module load time, so it can only ever run client-side.
const LocationPickerMap = dynamic(() => import('@/components/airdrop/location-picker-map').then((m) => m.LocationPickerMap), {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-md border bg-muted" />,
})
import { useCreateAirdropCampaign } from '@/hooks/useAirdropActions'
import { TxProgressDialog } from '@/components/airdrop/tx-progress'
import { estimateAirdropGasDeposit } from '@/lib/onchain/airdrop-gas'
import { toastSuccess, toastError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { AirdropAmountMode, AirdropGasMode, AirdropVisibility } from '@/types/airdrop'
import { ArrowLeft, ArrowRight, Check, CircleHelp } from 'lucide-react'
import Link from 'next/link'

const RELAYER_ADDRESS = process.env.NEXT_PUBLIC_AIRDROP_RELAYER_ADDRESS

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

const DECIMAL_RE = /^\d+(\.\d+)?$/

// Exact decimal-string × integer multiplication (no floating point, no dependency on the token's
// on-chain decimals() — that RPC call can be slow or never resolve while the form is still being
// filled in, and this multiplication doesn't actually need to know the token's decimals at all).
function multiplyDecimalString(amount: string, factor: number): string | null {
    const trimmed = amount.trim()
    if (!DECIMAL_RE.test(trimmed) || !Number.isInteger(factor) || factor <= 0) return null
    const [intPart, fracPart = ''] = trimmed.split('.')
    const scaled = BigInt(intPart + fracPart) * BigInt(factor)
    const digits = scaled.toString().padStart(fracPart.length + 1, '0')
    const cut = digits.length - fracPart.length
    const resultFrac = digits.slice(cut).replace(/0+$/, '')
    return resultFrac ? `${digits.slice(0, cut)}.${resultFrac}` : digits.slice(0, cut)
}

function compareDecimalStrings(a: string, b: string): number {
    const scale = (s: string) => s.split('.')[1]?.length ?? 0
    const places = Math.max(scale(a), scale(b))
    const toBigInt = (s: string) => {
        const [i, f = ''] = s.split('.')
        return BigInt(i + f.padEnd(places, '0'))
    }
    const diff = toBigInt(a) - toBigInt(b)
    return diff < 0n ? -1 : diff > 0n ? 1 : 0
}

export default function CreateAirdropPage() {
    const router = useRouter()
    const { isConnected } = useAccount()
    const publicClient = usePublicClient()
    const createCampaign = useCreateAirdropCampaign()

    const [tokenAddress, setTokenAddress] = useState('')
    const [amountMode, setAmountMode] = useState<AirdropAmountMode>('fixed')
    const [fixedAmount, setFixedAmount] = useState('')
    const [minAmount, setMinAmount] = useState('')
    const [maxAmount, setMaxAmount] = useState('')
    const [totalAmount, setTotalAmount] = useState('')
    const [limited, setLimited] = useState(true)
    const [maxClaimants, setMaxClaimants] = useState('')
    const [hasExpiry, setHasExpiry] = useState(false)
    const [expiresAt, setExpiresAt] = useState('')
    const [gasMode, setGasMode] = useState<AirdropGasMode>('self')
    const [visibility, setVisibility] = useState<AirdropVisibility>('public')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
    const [locationRestricted, setLocationRestricted] = useState(false)
    const [locationLat, setLocationLat] = useState<number | null>(null)
    const [locationLng, setLocationLng] = useState<number | null>(null)
    const [locationRadiusM, setLocationRadiusM] = useState('200')
    const [ipDedupeEnabled, setIpDedupeEnabled] = useState(false)
    const [step, setStep] = useState(0)

    const validToken = ADDRESS_RE.test(tokenAddress)
    const { data: tokenMeta } = useReadContracts({
        contracts: validToken
            ? [
                  { address: tokenAddress as Address, abi: erc20Abi, functionName: 'decimals' },
                  { address: tokenAddress as Address, abi: erc20Abi, functionName: 'symbol' },
              ]
            : [],
        query: { enabled: validToken },
    })
    const tokenDecimals = tokenMeta?.[0]?.result as number | undefined
    const tokenSymbol = tokenMeta?.[1]?.result as string | undefined

    const maxClaimantsNum = limited ? Number(maxClaimants) || 0 : 0
    const symbol = tokenSymbol ?? 'tokens'

    // Fixed + Limited: total is fully determined by the other two fields, so it's calculated
    // automatically instead of asking for a third number that has to be kept in sync by hand. Pure
    // decimal-string math — deliberately doesn't wait on the token's on-chain decimals()/symbol().
    const autoTotal =
        amountMode === 'fixed' && limited && maxClaimantsNum > 0 ? multiplyDecimalString(fixedAmount, maxClaimantsNum) : null

    // Random mode: mirrors AirdropEscrow.sol's createCampaign() feasibility checks so the form
    // catches them before submit — totalAmount must cover BOTH maxAmount on its own ("maxAmount
    // exceeds totalAmount", required unconditionally — a single claimant can't be authorized more
    // than the whole pot) and, when Limited, minAmount * maxClaimants ("totalAmount cannot cover
    // maxClaimants at minAmount"). The stricter (larger) of the two wins.
    const minForAllClaimants = limited && maxClaimantsNum > 0 ? multiplyDecimalString(minAmount, maxClaimantsNum) : null
    const minRequiredTotal =
        amountMode === 'random' && Number(maxAmount) > 0
            ? minForAllClaimants != null && compareDecimalStrings(minForAllClaimants, maxAmount) > 0
                ? minForAllClaimants
                : maxAmount
            : null
    const totalTooLowForRandom =
        minRequiredTotal != null && DECIMAL_RE.test(totalAmount.trim()) && compareDecimalStrings(totalAmount.trim(), minRequiredTotal) < 0

    // Relayer mode needs a maxClaimants cap to size its gas escrow (contract-enforced — see
    // AirdropEscrow.sol's "relayer mode requires a maxClaimants cap"), so it's not a valid choice
    // for an unlimited campaign at all — force back to self-pay instead of just warning about it.
    useEffect(() => {
        if (!limited && gasMode === 'relayer') setGasMode('self')
    }, [limited, gasMode])

    useEffect(() => {
        if (autoTotal != null) setTotalAmount(autoTotal)
    }, [autoTotal])

    // Random mode: no free-form entry either — total is locked to the minimum required (whichever
    // of maxAmount or minAmount*claimants is stricter, see minRequiredTotal above) so a creator can
    // never type in a total that would revert on-chain with "maxAmount exceeds totalAmount".
    useEffect(() => {
        if (amountMode === 'random' && minRequiredTotal != null) setTotalAmount(minRequiredTotal)
    }, [amountMode, minRequiredTotal])

    const preview = (() => {
        if (amountMode === 'fixed') {
            if (!Number(fixedAmount)) return null
            return limited && maxClaimantsNum > 0
                ? `→ ${maxClaimantsNum} people can each claim ${fixedAmount} ${symbol}.`
                : `→ Each claim gives ${fixedAmount} ${symbol}, until the pool runs out.`
        }
        if (!Number(minAmount) || !Number(maxAmount)) return null
        return limited && maxClaimantsNum > 0
            ? `→ Up to ${maxClaimantsNum} people, each getting between ${minAmount} and ${maxAmount} ${symbol}.`
            : `→ Random claims of ${minAmount}–${maxAmount} ${symbol} each, until the pool runs out.`
    })()

    const [gasDepositPreview, setGasDepositPreview] = useState<bigint | null>(null)
    useEffect(() => {
        if (gasMode !== 'relayer' || !limited || !Number(maxClaimants) || !publicClient) {
            setGasDepositPreview(null)
            return
        }
        let cancelled = false
        publicClient.getGasPrice().then((price) => {
            if (!cancelled) setGasDepositPreview(estimateAirdropGasDeposit(price, Number(maxClaimants)))
        })
        return () => {
            cancelled = true
        }
    }, [gasMode, limited, maxClaimants, publicClient])

    const captureLocation = () => {
        if (!('geolocation' in navigator)) {
            toastError("Your browser doesn't support location")
            return
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocationLat(pos.coords.latitude)
                setLocationLng(pos.coords.longitude)
            },
            () => toastError('Could not read your location'),
            { enableHighAccuracy: true, timeout: 10_000 }
        )
    }

    const incomplete =
        !validToken ||
        tokenDecimals == null ||
        !tokenSymbol ||
        !title.trim() ||
        !Number(totalAmount) ||
        (amountMode === 'fixed' ? !Number(fixedAmount) : !Number(minAmount) || !Number(maxAmount)) ||
        (limited && !Number(maxClaimants)) ||
        totalTooLowForRandom ||
        (hasExpiry && !expiresAt) ||
        (locationRestricted && (locationLat == null || locationLng == null || !Number(locationRadiusM))) ||
        (gasMode === 'relayer' && !RELAYER_ADDRESS) ||
        (gasMode === 'relayer' && !limited)

    const STEPS = ['Token & amount', 'Who pays gas?', 'Details', 'Restrictions'] as const
    const stepIncomplete = [
        !validToken ||
            tokenDecimals == null ||
            !tokenSymbol ||
            !Number(totalAmount) ||
            (amountMode === 'fixed' ? !Number(fixedAmount) : !Number(minAmount) || !Number(maxAmount)) ||
            (limited && !Number(maxClaimants)) ||
            totalTooLowForRandom,
        gasMode === 'relayer' && (!RELAYER_ADDRESS || !limited),
        !title.trim() || (hasExpiry && !expiresAt),
        false,
    ]
    const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
    const goBack = () => setStep((s) => Math.max(s - 1, 0))

    const submit = async () => {
        if (!isConnected) {
            toastError('Please connect your wallet first')
            return
        }
        if (incomplete || tokenDecimals == null || !tokenSymbol) return

        try {
            await createCampaign.createCampaignAsync({
                token: tokenAddress as Address,
                tokenSymbol,
                tokenDecimals,
                amountMode,
                fixedAmount: amountMode === 'fixed' ? parseUnits(fixedAmount, tokenDecimals) : 0n,
                minAmount: amountMode === 'random' ? parseUnits(minAmount, tokenDecimals) : 0n,
                maxAmount: amountMode === 'random' ? parseUnits(maxAmount, tokenDecimals) : 0n,
                totalAmount: parseUnits(totalAmount, tokenDecimals),
                maxClaimants: limited ? Number(maxClaimants) : 0,
                expiresAt: hasExpiry && expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : 0,
                gasMode,
                visibility,
                title: title.trim(),
                description: description.trim(),
                coverImageUrl: coverImageUrl ?? undefined,
                locationRestricted,
                locationLat: locationLat ?? undefined,
                locationLng: locationLng ?? undefined,
                locationRadiusM: locationRestricted ? Number(locationRadiusM) : undefined,
                ipDedupeEnabled,
            })
            toastSuccess('Airdrop created')
            router.push('/app/airdrop')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Creating the airdrop failed')
        }
    }

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6 lg:py-10">
            <Link href="/app/airdrop" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to airdrops</Link>
            <header className="border-b pb-6">
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Create an airdrop</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">Set up a transparent token giveaway. Your campaign will be ready to share as a link or QR code once the transaction confirms.</p>
            </header>

            <div className="flex items-center gap-2">
                {STEPS.map((label, i) => (
                    <div key={label} className="flex flex-1 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => i < step && setStep(i)}
                            disabled={i > step}
                            className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                                i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                            )}
                        >
                            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </button>
                        <span className={cn('hidden text-xs sm:inline', i === step ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
                        {i < STEPS.length - 1 && <div className={cn('h-px flex-1', i < step ? 'bg-primary/40' : 'bg-border')} />}
                    </div>
                ))}
            </div>

            {step === 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Token &amp; amount</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="token">Token contract address</Label>
                        <Input id="token" placeholder="0x…" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value.trim())} />
                        {validToken && tokenSymbol && tokenDecimals != null && (
                            <p className="text-xs text-muted-foreground">
                                Detected: {tokenSymbol} ({tokenDecimals} decimals)
                            </p>
                        )}
                        {validToken && tokenMeta && !tokenSymbol && (
                            <p className="text-xs text-destructive">Couldn&apos;t read this token — check the address and chain.</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label>Distribution</Label>
                        <RadioGroup value={amountMode} onValueChange={(v) => setAmountMode(v as AirdropAmountMode)} className="grid-cols-1 sm:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="fixed" id="mode-fixed" />
                                Fixed amount
                            </label>
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="random" id="mode-random" />
                                Random amount
                            </label>
                        </RadioGroup>
                    </div>

                    {amountMode === 'fixed' ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="fixedAmount">Amount per claim{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                            <Input id="fixedAmount" type="number" min="0" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="minAmount">Min per claim{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                                <Input id="minAmount" type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="maxAmount">Max per claim{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                                <Input id="maxAmount" type="number" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>Number of claimants</Label>
                        <RadioGroup value={limited ? 'limited' : 'unlimited'} onValueChange={(v) => setLimited(v === 'limited')} className="grid-cols-1 sm:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="limited" id="claimants-limited" />
                                Limited
                            </label>
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="unlimited" id="claimants-unlimited" />
                                Unlimited (until it runs out)
                            </label>
                        </RadioGroup>
                        {limited && (
                            <Input
                                type="number"
                                min="1"
                                placeholder="Number of people"
                                value={maxClaimants}
                                onChange={(e) => setMaxClaimants(e.target.value)}
                            />
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="totalAmount">Total giveaway amount{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                        <Input
                            id="totalAmount"
                            type="number"
                            min="0"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                            readOnly={(amountMode === 'fixed' && limited && autoTotal != null) || (amountMode === 'random' && minRequiredTotal != null)}
                            className={cn(totalTooLowForRandom && 'border-destructive focus-visible:ring-destructive')}
                        />
                        {amountMode === 'fixed' && limited ? (
                            <p className="text-xs text-muted-foreground">Calculated automatically: amount per claim × number of claimants.</p>
                        ) : amountMode === 'random' ? (
                            <p className={cn('text-xs', totalTooLowForRandom ? 'text-destructive' : 'text-muted-foreground')}>
                                {minRequiredTotal != null
                                    ? `Calculated automatically: the minimum required to cover max per claim${limited ? ' and every claimant\'s minimum' : ''} (${minRequiredTotal} ${symbol}).`
                                    : 'Set min and max per claim to see the total required.'}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">The campaign runs until this pool is claimed out.</p>
                        )}
                        {preview && <p className="text-xs font-medium">{preview}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="hasExpiry">Set an expiry</Label>
                            <Switch id="hasExpiry" checked={hasExpiry} onCheckedChange={setHasExpiry} />
                        </div>
                        {hasExpiry && <DateTimePicker value={expiresAt} onChange={setExpiresAt} />}
                    </div>
                </CardContent>
            </Card>
            )}

            {step === 1 && (limited ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Who pays gas to claim?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <RadioGroup value={gasMode} onValueChange={(v) => setGasMode(v as AirdropGasMode)} className="grid-cols-1">
                            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                                <RadioGroupItem value="self" id="gas-self" className="mt-0.5" />
                                <span>
                                    <span className="font-medium">Claimers pay their own gas</span>
                                    <br />
                                    <span className="text-muted-foreground">No deposit needed from you.</span>
                                </span>
                            </label>
                            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                                <RadioGroupItem value="relayer" id="gas-relayer" className="mt-0.5" />
                                <span>
                                    <span className="font-medium">I pay gas for claimers</span>
                                    <br />
                                    <span className="text-muted-foreground">
                                        Claimers pay nothing. You need to deposit KUB to the relayer wallet to cover their gas.
                                    </span>
                                </span>
                            </label>
                        </RadioGroup>
                        {gasMode === 'relayer' && (
                            <div className="space-y-1.5">
                                {RELAYER_ADDRESS ? (
                                    <p className="text-xs text-muted-foreground">
                                        {gasDepositPreview != null
                                            ? `Estimated gas deposit: ~${formatUnits(gasDepositPreview, 18)} KUB, held in the campaign contract and refundable via "Reclaim gas" once the campaign ends.`
                                            : 'Set a limited number of claimants to see the estimated gas deposit.'}
                                    </p>
                                ) : (
                                    <p className="text-xs text-destructive">The relayer service is not configured yet — ask an admin.</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Claimers pay their own gas.</span> Unlimited campaigns can&apos;t use
                            the &quot;I pay gas for claimers&quot; option — it escrows gas per claim slot, which needs a fixed number of
                            claimants. Switch to Limited above to enable it.
                        </p>
                    </CardContent>
                </Card>
            ))}

            {step === 2 && (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <ImageUploadField value={coverImageUrl} onChange={setCoverImageUrl} label="Cover image" />
                    <div className="space-y-1.5">
                        <Label>Who can find this?</Label>
                        <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as AirdropVisibility)} className="grid-cols-1 sm:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="public" id="visibility-public" />
                                Public
                            </label>
                            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value="unlisted" id="visibility-unlisted" />
                                QR code / link only
                            </label>
                        </RadioGroup>
                        <p className="text-xs text-muted-foreground">
                            {visibility === 'public'
                                ? 'Shown on the Browse Airdrops page.'
                                : "Not listed anywhere — only reachable by whoever has the QR code or share link."}
                        </p>
                    </div>
                </CardContent>
            </Card>
            )}

            {step === 3 && (
            <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Optional restrictions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="locationRestricted">Limit to a location</Label>
                            <Switch id="locationRestricted" checked={locationRestricted} onCheckedChange={setLocationRestricted} />
                        </div>
                        {locationRestricted && (
                            <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">Click the map to set the center, or drag the pin. Use the button for your current location.</p>
                                <LocationPickerMap
                                    lat={locationLat}
                                    lng={locationLng}
                                    radiusM={Number(locationRadiusM) || 0}
                                    onChange={(lat, lng) => {
                                        setLocationLat(lat)
                                        setLocationLng(lng)
                                    }}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={captureLocation}>
                                    {locationLat != null ? 'Update my location' : 'Use my current location as center'}
                                </Button>
                                {locationLat != null && locationLng != null && (
                                    <p className="text-xs text-muted-foreground">
                                        Center: {locationLat.toFixed(5)}, {locationLng.toFixed(5)}
                                    </p>
                                )}
                                <div className="space-y-1.5">
                                    <Label htmlFor="radius">Radius (meters)</Label>
                                    <Input id="radius" type="number" min="1" value={locationRadiusM} onChange={(e) => setLocationRadiusM(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="ipDedupe">Block repeat claims from the same network</Label>
                            <p className="text-xs text-muted-foreground">
                                Rejects a second claim attempt from the same IP address.
                                {!locationRestricted && ' Recommended if claimers can enter an address without connecting a wallet.'}
                            </p>
                        </div>
                        <Switch id="ipDedupe" checked={ipDedupeEnabled} onCheckedChange={setIpDedupeEnabled} />
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground"><div className="flex items-start gap-2"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0" /><p>Review your token address, total pool, and visibility before creating. Blockchain transactions cannot be undone.</p></div></div>
            </>
            )}

            <div className="flex gap-3">
                {step > 0 && (
                    <Button type="button" variant="outline" size="lg" className="flex-1" onClick={goBack}>
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                )}
                {step < STEPS.length - 1 ? (
                    <Button type="button" size="lg" className="flex-1" disabled={stepIncomplete[step]} onClick={goNext}>
                        Next <ArrowRight className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        className="flex-1"
                        size="lg"
                        disabled={incomplete || createCampaign.isPending}
                        isLoading={createCampaign.isPending}
                        loadingText="Creating airdrop…"
                        onClick={submit}
                    >
                        Create airdrop
                    </Button>
                )}
            </div>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> You can manage or reclaim the campaign later</p>
            <TxProgressDialog phase={createCampaign.phase} />
        </div>
    )
}
