'use client'

import { useState } from 'react'
import { useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { airdropEscrowAdminAbi } from '@/lib/abis/airdrop'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import { useIsAdmin } from '@/hooks/useOnChainRoles'
import { toastError, toastSuccess } from '@/lib/toast'

const AIRDROP_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_AIRDROP_ESCROW_ADDRESS as Address | undefined

/**
 * Emergency stop for AirdropEscrow. Pausing blocks createCampaign/claim/claimFor only — reclaim()
 * and reclaimGas() stay open by design (see the contract's whenNotPaused placement), so pausing
 * never traps a creator's funds.
 */
export function AirdropPause() {
    const isAdmin = useIsAdmin()
    const write = useSimulatedWrite()
    const [busy, setBusy] = useState(false)

    const { data: paused, refetch } = useReadContract({
        address: AIRDROP_ESCROW_ADDRESS,
        abi: airdropEscrowAdminAbi,
        functionName: 'paused',
        query: { enabled: Boolean(AIRDROP_ESCROW_ADDRESS) },
    })

    if (!AIRDROP_ESCROW_ADDRESS) return null

    const toggle = async () => {
        setBusy(true)
        try {
            await write({
                address: AIRDROP_ESCROW_ADDRESS,
                abi: airdropEscrowAdminAbi,
                functionName: paused ? 'unpause' : 'pause',
            })
            toastSuccess(paused ? 'Airdrops resumed' : 'Airdrops paused')
            await refetch()
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Could not change pause state')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    Emergency stop
                    <Badge variant={paused ? 'destructive' : 'secondary'}>{paused ? 'Paused' : 'Live'}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                    Pausing stops new campaigns and all claims on-chain. Reclaiming a pool or a gas deposit keeps
                    working while paused.
                </p>
                <Button
                    variant={paused ? 'default' : 'destructive'}
                    size="sm"
                    disabled={!isAdmin || busy}
                    isLoading={busy}
                    loadingText={paused ? 'Resuming…' : 'Pausing…'}
                    onClick={toggle}
                >
                    {paused ? 'Resume' : 'Pause'}
                </Button>
            </CardContent>
        </Card>
    )
}
