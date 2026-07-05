'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useMockKyc } from '@/store/mock-kyc'
import { toastSuccess } from '@/lib/toast'

function shortAddr(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Admin review queue for seller KYC applications.
// Real flow: approve/reject hits admin endpoints; documents live in a private bucket.
export function KycQueue() {
    const applications = useMockKyc((s) => s.applications)
    const review = useMockKyc((s) => s.review)

    const pending = applications.filter((a) => a.status === 'pending')

    if (pending.length === 0) {
        return (
            <EmptyState
                title="No pending applications"
                description="Seller KYC applications awaiting review will appear here."
            />
        )
    }

    return (
        <div className="space-y-3">
            {pending.map((a) => (
                <Card key={a.wallet}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{a.fullName}</span>
                                <Badge variant="secondary" className="font-mono">
                                    {shortAddr(a.wallet)}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ID {a.idNumber} · {a.phone} · {a.email}
                                {a.idDocumentName && ` · Doc: ${a.idDocumentName}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{a.address}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => {
                                    review(a.wallet, 'verified')
                                    toastSuccess(`${a.fullName} verified (mock)`)
                                }}
                            >
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    review(a.wallet, 'rejected', 'Rejected by reviewer')
                                    toastSuccess(`${a.fullName} rejected (mock)`)
                                }}
                            >
                                Reject
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
