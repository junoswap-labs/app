'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ImageUploadField } from '@/components/ui/image-upload'
import { DeadlineCountdown } from '@/components/rwa/ship-deadline-countdown'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { useReportRedeemDispute } from '@/hooks/useRedeemOrders'
import { useOpenRedeemDispute } from '@/hooks/useRedeemMerchActions'
import { DISPUTE_GRACE_MS } from '@/types/rwa'
import { toastError, toastSuccess } from '@/lib/toast'

const COPY = {
    buyer: {
        trigger: 'Report — not received',
        title: 'Report a fake or missing shipment',
        description: "Describe what's wrong and attach evidence (e.g. the tracking page showing no movement). This opens an on-chain dispute — an admin will review and decide the payout.",
    },
    seller: {
        trigger: 'Report — buyer unresponsive',
        title: "Report a buyer who won't confirm receipt",
        description: 'Describe the situation and attach proof of delivery if you have it. This opens an on-chain dispute — an admin will review and decide the payout.',
    },
} as const

/** Buyer- or seller-facing "open a dispute" flow for a Shipped merch order: records reason +
 *  evidence off-chain (see app/api/redeem/orders/[id]/dispute), then sends the actual openDispute()
 *  tx with the caller's own wallet — RwaEscrow.sol only allows that once DISPUTE_GRACE has passed
 *  since shipping, so the trigger stays disabled until then rather than letting the tx go and
 *  revert. */
export function ReportDisputeDialog({
    role,
    orderId,
    listingId,
    shippedAt,
}: {
    role: 'buyer' | 'seller'
    orderId: string
    listingId: `0x${string}`
    shippedAt: string
}) {
    const [open, setOpen] = useState(false)
    const [detail, setDetail] = useState('')
    const [evidenceUrls, setEvidenceUrls] = useState<(string | null)[]>([null])
    const report = useReportRedeemDispute()
    const openDispute = useOpenRedeemDispute()
    const [submitting, setSubmitting] = useState(false)

    const graceEndsAt = new Date(shippedAt).getTime() + DISPUTE_GRACE_MS
    const canReport = Date.now() >= graceEndsAt
    const copy = COPY[role]

    const submit = async () => {
        if (!detail.trim()) return toastError('Please describe what happened')
        setSubmitting(true)
        try {
            await report.mutateAsync({ orderId, detail, evidenceUrls: evidenceUrls.filter((u): u is string => Boolean(u)) })
            await openDispute.openDisputeAsync(listingId)
            toastSuccess('Dispute opened — an admin will review it')
            setOpen(false)
            setDetail('')
            setEvidenceUrls([null])
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Could not open dispute')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={!canReport} className="gap-1.5">
                    <Flag className="h-3.5 w-3.5" /> {copy.trigger}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{copy.title}</DialogTitle>
                    <DialogDescription>{copy.description}</DialogDescription>
                </DialogHeader>

                {!canReport ? (
                    <DeadlineCountdown deadline={graceEndsAt} label="Dispute grace period" />
                ) : (
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="disputeDetail">What happened</Label>
                            <Textarea id="disputeDetail" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Evidence (up to 3 photos, optional)</Label>
                            <div className="flex flex-wrap gap-3">
                                {evidenceUrls.map((url, i) => (
                                    <ImageUploadField
                                        key={i}
                                        value={url}
                                        onChange={(v) => setEvidenceUrls((prev) => prev.map((u, idx) => (idx === i ? v : u)))}
                                        label={`Photo ${i + 1}`}
                                    />
                                ))}
                                {evidenceUrls.length < 3 && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => setEvidenceUrls((prev) => [...prev, null])}>
                                        + Add photo
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {canReport && (
                    <DialogFooter>
                        <Button variant="destructive" isLoading={submitting} loadingText="Opening dispute…" disabled={submitting} onClick={submit}>
                            Open dispute
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
