'use client'

import { useReadContract } from 'wagmi'
import { rwaEscrowAbi } from '@/lib/abis/rwa-escrow'
import { DeadlineCountdown } from '@/components/rwa/ship-deadline-countdown'
import { Button } from '@/components/ui/button'
import { useConfirmRedeemReceived, useExtendRedeemAutoRelease, useClaimRedeemShipmentTimeout } from '@/hooks/useRedeemMerchActions'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { AUTO_RELEASE_DEADLINE_MS } from '@/types/rwa'
import { useContractAddresses } from '@/hooks/useContractAddresses'
import { ReportDisputeDialog } from '@/components/redeem/report-dispute-dialog'

type ActionKey = 'confirm' | 'extend' | 'claim'

/**
 * Buyer-facing auto-release controls for a 'Shipped' merch order — the one-time 7-day extension is
 * only known on-chain (see contracts/src/RwaEscrow.sol's autoReleaseExtension mapping, deliberately
 * not mirrored into Supabase), so this reads it live instead of guessing from order history.
 */
export function RedemptionAutoReleasePanel({
    orderId,
    listingId,
    shippedAt,
}: {
    orderId: string
    listingId: `0x${string}`
    shippedAt: string
}) {
    const { redeemRwaEscrow: REDEEM_RWA_ESCROW_ADDRESS } = useContractAddresses()
    const { data: extensionSecs } = useReadContract({
        address: REDEEM_RWA_ESCROW_ADDRESS,
        abi: rwaEscrowAbi,
        functionName: 'autoReleaseExtension',
        args: [listingId],
        query: { enabled: Boolean(REDEEM_RWA_ESCROW_ADDRESS) },
    })
    const confirmReceived = useConfirmRedeemReceived()
    const extend = useExtendRedeemAutoRelease()
    const claimTimeout = useClaimRedeemShipmentTimeout()
    const { run, isPending } = useAsyncAction<ActionKey>()

    const deadline = new Date(shippedAt).getTime() + AUTO_RELEASE_DEADLINE_MS + Number(extensionSecs ?? 0n) * 1000
    const extended = Boolean(extensionSecs && extensionSecs > 0n)
    const deadlinePassed = Date.now() > deadline

    return (
        <div className="space-y-2 border-t pt-3">
            <DeadlineCountdown deadline={deadline} label="Auto-release to lister if not confirmed" />
            <div className="flex flex-wrap gap-2">
                {!deadlinePassed && (
                    <Button
                        size="sm"
                        isLoading={isPending('confirm')}
                        loadingText="Confirming…"
                        disabled={isPending('confirm')}
                        onClick={() => run('confirm', async () => { await confirmReceived.confirmReceivedAsync(listingId) }, 'Received — funds released to the lister')}
                    >
                        Confirm received
                    </Button>
                )}
                {!extended && !deadlinePassed && (
                    <Button
                        size="sm"
                        variant="outline"
                        isLoading={isPending('extend')}
                        loadingText="Extending…"
                        disabled={isPending('extend')}
                        onClick={() => run('extend', async () => { await extend.extendAsync(listingId) }, 'Auto-release deadline extended by 7 days')}
                    >
                        Extend 7 days
                    </Button>
                )}
                {deadlinePassed && (
                    <Button
                        size="sm"
                        variant="outline"
                        isLoading={isPending('claim')}
                        loadingText="Releasing…"
                        disabled={isPending('claim')}
                        onClick={() => run('claim', async () => { await claimTimeout.claimAsync(listingId) }, 'Deadline passed — funds released to the lister')}
                    >
                        Release to lister (deadline passed)
                    </Button>
                )}
                <ReportDisputeDialog role="buyer" orderId={orderId} listingId={listingId} shippedAt={shippedAt} />
            </div>
        </div>
    )
}
