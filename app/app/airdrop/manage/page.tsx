'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { AirdropCampaignCard } from '@/components/airdrop/campaign-card'
import { useMyAirdropCampaigns } from '@/hooks/useAirdropCampaigns'
import { useReclaimAirdropCampaign, useReclaimAirdropGas } from '@/hooks/useAirdropActions'
import { toastSuccess, toastError } from '@/lib/toast'

export default function ManageAirdropsPage() {
    const { address, isConnected } = useAccount()
    const { data: campaigns, isLoading } = useMyAirdropCampaigns(address)
    const reclaim = useReclaimAirdropCampaign()
    const reclaimGas = useReclaimAirdropGas()

    if (!isConnected) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                <EmptyState title="Connect your wallet" description="Connect a wallet to see the airdrops you've created." />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-semibold tracking-tight">My Airdrops</h1>
                <Button asChild>
                    <Link href="/app/airdrop/create">Create airdrop</Link>
                </Button>
            </div>

            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !campaigns || campaigns.length === 0 ? (
                <EmptyState
                    title="No airdrops yet"
                    description="Create a shareable link or QR code to give away tokens."
                    action={
                        <Button asChild>
                            <Link href="/app/airdrop/create">Create your first airdrop</Link>
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {campaigns.map((c) => {
                        const expired = c.expires_at != null && new Date(c.expires_at).getTime() < Date.now()
                        const canReclaim = expired && c.status !== 'reclaimed'
                        const canReclaimGas = c.gas_mode === 'relayer' && (c.status !== 'active' || expired)
                        return (
                            <div key={c.id} className="space-y-2">
                                <AirdropCampaignCard campaign={c} />
                                {canReclaim && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        isLoading={reclaim.isPending}
                                        loadingText="Reclaiming…"
                                        onClick={async () => {
                                            try {
                                                await reclaim.reclaimAsync(c.id as `0x${string}`)
                                                toastSuccess('Unclaimed tokens returned to your wallet')
                                            } catch (err) {
                                                toastError(err instanceof Error ? err.message : 'Reclaim failed')
                                            }
                                        }}
                                    >
                                        Reclaim unclaimed tokens
                                    </Button>
                                )}
                                {canReclaimGas && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                        isLoading={reclaimGas.isPending}
                                        loadingText="Reclaiming…"
                                        onClick={async () => {
                                            try {
                                                await reclaimGas.reclaimGasAsync(c.id as `0x${string}`)
                                                toastSuccess('Unspent gas deposit returned to your wallet')
                                            } catch (err) {
                                                toastError(err instanceof Error ? err.message : 'Reclaim failed')
                                            }
                                        }}
                                    >
                                        Reclaim gas
                                    </Button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
