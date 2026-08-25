'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, usePublicClient, useReadContracts } from 'wagmi'
import { parseUnits } from 'viem'
import type { Address } from 'viem'
import { erc20Abi } from '@/lib/abis/erc20'
import { StepTokenAmount } from '@/components/airdrop/create-steps/step-token-amount'
import { StepGas } from '@/components/airdrop/create-steps/step-gas'
import { StepDetails } from '@/components/airdrop/create-steps/step-details'
import { StepRestrictions } from '@/components/airdrop/create-steps/step-restrictions'
import { useCreateAirdropCampaign } from '@/hooks/useAirdropActions'
import { TxProgressDialog } from '@/components/airdrop/tx-progress'
import { estimateAirdropGasDeposit } from '@/lib/onchain/airdrop-gas'
import { toastSuccess, toastError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { AirdropAmountMode, AirdropGasMode, AirdropVisibility } from '@/types/airdrop'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import { useContractAddresses } from '@/hooks/useContractAddresses'

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
    const { airdropRelayer: RELAYER_ADDRESS } = useContractAddresses()
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

    // Random mode: the pool has to cover the *worst case*, maxAmount * maxClaimants, not just the
    // contract's own floor (maxAmount alone, plus minAmount * maxClaimants when Limited). Funding
    // only the floor makes the campaign lie: with min 1 / max 1000 over 10 claimants, a 1000 pool
    // lets the first claimer draw up to 999 and the rest split crumbs, even though the form
    // promised "up to 10 people, each getting between 1 and 1000". Sizing for the possibility is
    // what makes that sentence true; the creator reclaims whatever goes unclaimed.
    const maxForAllClaimants = limited && maxClaimantsNum > 0 ? multiplyDecimalString(maxAmount, maxClaimantsNum) : null
    const minRequiredTotal =
        amountMode === 'random' && Number(maxAmount) > 0 ? (maxForAllClaimants ?? maxAmount) : null
    const totalTooLowForRandom =
        minRequiredTotal != null && DECIMAL_RE.test(totalAmount.trim()) && compareDecimalStrings(totalAmount.trim(), minRequiredTotal) < 0

    const totalReadOnly = (amountMode === 'fixed' && limited && autoTotal != null) || (amountMode === 'random' && minRequiredTotal != null)
    const totalHelperText =
        amountMode === 'fixed' && limited
            ? 'Calculated automatically: amount per claim × number of claimants.'
            : amountMode === 'random'
              ? (minRequiredTotal != null
                    ? limited
                        ? `Calculated automatically: max per claim × number of claimants (${minRequiredTotal} ${symbol}) — enough for everyone to hit the maximum. Whatever isn't claimed comes back to you.`
                        : `Calculated automatically: at least max per claim (${minRequiredTotal} ${symbol}), since one claimer can draw that much.`
                    : 'Set min and max per claim to see the total required.')
              : 'The campaign runs until this pool is claimed out.'

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
                <StepTokenAmount
                    tokenAddress={tokenAddress}
                    setTokenAddress={setTokenAddress}
                    validToken={validToken}
                    tokenSymbol={tokenSymbol}
                    tokenDecimals={tokenDecimals}
                    tokenMetaLoaded={Boolean(tokenMeta)}
                    amountMode={amountMode}
                    setAmountMode={setAmountMode}
                    fixedAmount={fixedAmount}
                    setFixedAmount={setFixedAmount}
                    minAmount={minAmount}
                    setMinAmount={setMinAmount}
                    maxAmount={maxAmount}
                    setMaxAmount={setMaxAmount}
                    limited={limited}
                    setLimited={setLimited}
                    maxClaimants={maxClaimants}
                    setMaxClaimants={setMaxClaimants}
                    totalAmount={totalAmount}
                    setTotalAmount={setTotalAmount}
                    totalReadOnly={totalReadOnly}
                    totalTooLowForRandom={totalTooLowForRandom}
                    totalHelperText={totalHelperText}
                    preview={preview}
                    hasExpiry={hasExpiry}
                    setHasExpiry={setHasExpiry}
                    expiresAt={expiresAt}
                    setExpiresAt={setExpiresAt}
                />
            )}

            {step === 1 && (
                <StepGas
                    limited={limited}
                    gasMode={gasMode}
                    setGasMode={setGasMode}
                    relayerAddress={RELAYER_ADDRESS}
                    gasDepositPreview={gasDepositPreview}
                />
            )}

            {step === 2 && (
                <StepDetails
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    coverImageUrl={coverImageUrl}
                    setCoverImageUrl={setCoverImageUrl}
                    visibility={visibility}
                    setVisibility={setVisibility}
                />
            )}

            {step === 3 && (
                <StepRestrictions
                    locationRestricted={locationRestricted}
                    setLocationRestricted={setLocationRestricted}
                    locationLat={locationLat}
                    locationLng={locationLng}
                    setLocationLat={setLocationLat}
                    setLocationLng={setLocationLng}
                    locationRadiusM={locationRadiusM}
                    setLocationRadiusM={setLocationRadiusM}
                    captureLocation={captureLocation}
                    ipDedupeEnabled={ipDedupeEnabled}
                    setIpDedupeEnabled={setIpDedupeEnabled}
                />
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
