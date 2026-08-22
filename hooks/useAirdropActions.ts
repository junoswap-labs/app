'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { airdropEscrowAbi } from '@/lib/abis/airdrop'
import { ensureTokenAllowance } from '@/lib/onchain/erc20'
import { estimateAirdropGasDeposit } from '@/lib/onchain/airdrop-gas'
import { useSyncRefresh } from '@/hooks/useSyncRefresh'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import type { AirdropAmountMode, AirdropGasMode, AirdropVisibility } from '@/types/airdrop'

const AIRDROP_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AIRDROP_ESCROW_ADDRESS as Address | undefined

// Mirrors AirdropEscrow's enum orderings exactly (contracts/src/AirdropEscrow.sol).
const AMOUNT_MODE: Record<AirdropAmountMode, number> = { fixed: 0, random: 1 }
const GAS_MODE: Record<AirdropGasMode, number> = { self: 0, relayer: 1 }

function randomCampaignId(): `0x${string}` {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Where a write currently is, so the UI can animate the wait instead of showing one flat spinner.
 * `signing` = the wallet popup is open and we're blocked on the user; `pending` = the tx is
 * broadcast and we're only waiting on the chain. Those two are the ones worth telling apart —
 * only the second is a wait the user can't do anything about.
 */
export type AirdropTxPhase = 'idle' | 'checking' | 'approving' | 'signing' | 'pending' | 'saving'

export interface CreateAirdropCampaignInput {
    token: Address
    tokenSymbol: string
    tokenDecimals: number
    amountMode: AirdropAmountMode
    fixedAmount: bigint // amountMode === 'fixed'
    minAmount: bigint // amountMode === 'random'
    maxAmount: bigint // amountMode === 'random'
    totalAmount: bigint
    maxClaimants: number // 0 = unlimited
    expiresAt: number // unix seconds, 0 = no expiry
    gasMode: AirdropGasMode
    visibility: AirdropVisibility
    title: string
    description: string
    coverImageUrl?: string
    locationRestricted: boolean
    locationLat?: number
    locationLng?: number
    locationRadiusM?: number
    ipDedupeEnabled: boolean
}

/**
 * campaignId is minted client-side (crypto.getRandomValues, same collision-safety as the
 * randomBytes(32) ids minted server-side elsewhere in this app — see app/api/redeem/orders) and
 * passed straight into createCampaign(). gas_mode now travels on-chain (part of the
 * CampaignCreated event, see contracts/src/AirdropEscrow.sol) so the sync poller writes it
 * directly — only the remaining off-chain-only fields (title/description/GPS/IP-dedupe toggle)
 * are attached via a separate PATCH afterwards (see app/api/airdrop/campaigns/[id]/metadata).
 */
const METADATA_ATTEMPTS = 4
const METADATA_RETRY_DELAY_MS = 2_500

export function useCreateAirdropCampaign() {
    const { address } = useAccount()
    const { writeContractAsync } = useWriteContract()
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()
    const [phase, setPhase] = useState<AirdropTxPhase>('idle')

    const mutation = useMutation({
        mutationFn: async (input: CreateAirdropCampaignInput) => {
            if (!AIRDROP_ESCROW_ADDRESS) throw new Error('AirdropEscrow is not deployed yet')
            if (!address) throw new Error('connect your wallet first')
            if (!publicClient) throw new Error('no public client available')
            if (input.gasMode === 'relayer' && input.maxClaimants <= 0) {
                throw new Error('a "creator pays gas" campaign needs a limited number of claimants')
            }

            setPhase('approving')
            await ensureTokenAllowance({
                publicClient,
                writeContractAsync,
                token: input.token,
                owner: address,
                spender: AIRDROP_ESCROW_ADDRESS,
                amount: input.totalAmount,
            })

            const gasDeposit =
                input.gasMode === 'relayer'
                    ? estimateAirdropGasDeposit(await publicClient.getGasPrice(), input.maxClaimants)
                    : 0n

            const campaignId = randomCampaignId()
            setPhase('signing')
            const hash = await write({
                address: AIRDROP_ESCROW_ADDRESS,
                abi: airdropEscrowAbi,
                functionName: 'createCampaign',
                args: [
                    {
                        campaignId,
                        token: input.token,
                        amountMode: AMOUNT_MODE[input.amountMode],
                        fixedAmount: input.fixedAmount,
                        minAmount: input.minAmount,
                        maxAmount: input.maxAmount,
                        totalAmount: input.totalAmount,
                        maxClaimants: input.maxClaimants,
                        expiresAt: BigInt(input.expiresAt),
                        gasMode: GAS_MODE[input.gasMode],
                        gasDeposit,
                    },
                ],
                value: gasDeposit,
            })
            setPhase('pending')
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()

            setPhase('saving')
            const metadata = {
                token_symbol: input.tokenSymbol,
                token_decimals: input.tokenDecimals,
                visibility: input.visibility,
                title: input.title,
                description: input.description,
                cover_image_url: input.coverImageUrl ?? null,
                location_restricted: input.locationRestricted,
                location_lat: input.locationLat ?? null,
                location_lng: input.locationLng ?? null,
                location_radius_m: input.locationRadiusM ?? null,
                ip_dedupe_enabled: input.ipDedupeEnabled,
            }

            // The metadata route requires the poller to have indexed CampaignCreated first and
            // answers 409 until it has (it can't upsert — the on-chain-authoritative columns are
            // NOT NULL). One sync nudge isn't always enough when the poller has ground to catch up,
            // so retry the pair a few times rather than losing the title/image the user just typed.
            let lastError = 'saving campaign details failed'
            for (let attempt = 0; attempt < METADATA_ATTEMPTS; attempt++) {
                const res = await fetch(`/api/airdrop/campaigns/${campaignId}/metadata`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(metadata),
                })
                if (res.ok) break
                const body = await res.json().catch(() => null)
                lastError = body?.error ?? `saving campaign details failed: ${res.status}`
                if (res.status !== 409 || attempt === METADATA_ATTEMPTS - 1) throw new Error(lastError)
                await new Promise((resolve) => setTimeout(resolve, METADATA_RETRY_DELAY_MS))
                await syncRefresh.mutateAsync()
            }

            return { campaignId, hash }
        },
        onSettled: () => setPhase('idle'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns'] })
        },
    })

    return { ...mutation, phase, createCampaignAsync: mutation.mutateAsync }
}

export interface ClaimAirdropInput {
    campaignId: `0x${string}`
    recipient: Address
    gps?: { lat: number; lng: number }
}

/**
 * One hook for both gas-payment modes — the campaign's gas_mode decides the path server-side
 * (POST /api/airdrop/claim), not the caller. That route always runs the GPS/IP/already-claimed
 * gate first, then either says "go ahead and submit claim() yourself" (self-pay) or has already
 * relayed + confirmed claimFor() on-chain itself (relayer-pay) before responding.
 */
export function useClaimAirdrop() {
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()
    const [phase, setPhase] = useState<AirdropTxPhase>('idle')

    const mutation = useMutation({
        mutationFn: async (input: ClaimAirdropInput) => {
            setPhase('checking')
            const res = await fetch('/api/airdrop/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: input.campaignId, recipient: input.recipient, gps: input.gps }),
            })
            const gate = await res.json().catch(() => null)
            if (!res.ok) throw new Error(gate?.error ?? `claim failed: ${res.status}`)

            if (gate.mode === 'self') {
                if (!AIRDROP_ESCROW_ADDRESS) throw new Error('AirdropEscrow is not deployed yet')
                if (!publicClient) throw new Error('no public client available')
                setPhase('signing')
                const hash = await write({
                    address: AIRDROP_ESCROW_ADDRESS,
                    abi: airdropEscrowAbi,
                    functionName: 'claim',
                    args: [input.campaignId, input.recipient, BigInt(gate.amount), BigInt(gate.deadline), gate.signature],
                })
                // The wallet has signed and broadcast — from here the amount is locked in and the
                // reveal animation can start rolling while we wait on the receipt.
                setPhase('pending')
                await publicClient.waitForTransactionReceipt({ hash })
            }
            // relayer mode: /api/airdrop/claim already waited for the relayed tx's receipt.

            await syncRefresh.mutateAsync()
            return gate as {
                ok: true
                mode: 'self' | 'relayer'
                amount?: string
                deadline?: string
                signature?: `0x${string}`
                txHash?: string
                status?: string
            }
        },
        onSettled: () => setPhase('idle'),
        onSuccess: (_data, input) => {
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns', input.campaignId] })
            queryClient.invalidateQueries({ queryKey: ['airdrop-claims', input.campaignId] })
        },
    })

    return { ...mutation, phase, claimAsync: mutation.mutateAsync }
}

/** Force-stops a live campaign: no further claims, and the unclaimed pool (plus any unspent gas
 *  deposit) becomes reclaimable straight away — the only way out for a campaign created without an
 *  expiry. Irreversible on-chain, see endCampaign() in contracts/src/AirdropEscrow.sol. */
export function useEndAirdropCampaign() {
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: async (campaignId: `0x${string}`) => {
            if (!AIRDROP_ESCROW_ADDRESS) throw new Error('AirdropEscrow is not deployed yet')
            if (!publicClient) throw new Error('no public client available')
            const hash = await write({
                address: AIRDROP_ESCROW_ADDRESS,
                abi: airdropEscrowAbi,
                functionName: 'endCampaign',
                args: [campaignId],
            })
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()
            return hash
        },
        onSuccess: (_data, campaignId) => {
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns'] })
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns', campaignId] })
        },
    })

    return { ...mutation, endCampaignAsync: mutation.mutateAsync }
}

export function useReclaimAirdropCampaign() {
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: async (campaignId: `0x${string}`) => {
            if (!AIRDROP_ESCROW_ADDRESS) throw new Error('AirdropEscrow is not deployed yet')
            if (!publicClient) throw new Error('no public client available')
            const hash = await write({
                address: AIRDROP_ESCROW_ADDRESS,
                abi: airdropEscrowAbi,
                functionName: 'reclaim',
                args: [campaignId],
            })
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()
            return hash
        },
        onSuccess: (_data, campaignId) => {
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns'] })
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns', campaignId] })
        },
    })

    return { ...mutation, reclaimAsync: mutation.mutateAsync }
}

/** Manual sweep of a relayer-mode campaign's unspent gas deposit — see reclaimGas() in
 *  contracts/src/AirdropEscrow.sol. Independent of useReclaimAirdropCampaign (the token pool). */
export function useReclaimAirdropGas() {
    const write = useSimulatedWrite()
    const publicClient = usePublicClient()
    const syncRefresh = useSyncRefresh()
    const queryClient = useQueryClient()

    const mutation = useMutation({
        mutationFn: async (campaignId: `0x${string}`) => {
            if (!AIRDROP_ESCROW_ADDRESS) throw new Error('AirdropEscrow is not deployed yet')
            if (!publicClient) throw new Error('no public client available')
            const hash = await write({
                address: AIRDROP_ESCROW_ADDRESS,
                abi: airdropEscrowAbi,
                functionName: 'reclaimGas',
                args: [campaignId],
            })
            await publicClient.waitForTransactionReceipt({ hash })
            await syncRefresh.mutateAsync()
            return hash
        },
        onSuccess: (_data, campaignId) => {
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns'] })
            queryClient.invalidateQueries({ queryKey: ['airdrop-campaigns', campaignId] })
        },
    })

    return { ...mutation, reclaimGasAsync: mutation.mutateAsync }
}
