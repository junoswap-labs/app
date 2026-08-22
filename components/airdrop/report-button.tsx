'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { toastError, toastSuccess } from '@/lib/toast'

const REASONS = [
    { value: 'scam', label: 'Scam or fake token' },
    { value: 'adult', label: 'Adult content' },
    { value: 'gambling', label: 'Gambling' },
    { value: 'impersonation', label: 'Impersonating a brand or person' },
    { value: 'other', label: 'Something else' },
] as const

/** Reports go to the admin queue (Admin → Reports); they don't hide anything on their own. Only a
 *  signed-in wallet can report, so the queue can be triaged by reporter rather than by raw volume. */
export function ReportButton({ subjectType, subjectId }: { subjectType: 'airdrop_campaign' | 'redeem_item'; subjectId: string }) {
    const [open, setOpen] = useState(false)
    const [reason, setReason] = useState<string>('scam')
    const [detail, setDetail] = useState('')

    const submit = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject_type: subjectType, subject_id: subjectId, reason, detail }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `report failed: ${res.status}`)
            }
        },
        onSuccess: () => {
            toastSuccess('Thanks — an admin will review this')
            setOpen(false)
            setDetail('')
        },
        onError: (err) => toastError(err instanceof Error ? err.message : 'Could not send report'),
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <Flag className="mr-1.5 h-4 w-4" /> Report
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Report this airdrop</DialogTitle>
                    <DialogDescription>
                        Tell us what&apos;s wrong with it. Reports are reviewed by an admin — the tokens stay on-chain
                        either way.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <RadioGroup value={reason} onValueChange={setReason} className="grid-cols-1">
                        {REASONS.map((option) => (
                            <label key={option.value} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                                <RadioGroupItem value={option.value} id={`reason-${option.value}`} />
                                {option.label}
                            </label>
                        ))}
                    </RadioGroup>

                    <div className="space-y-1.5">
                        <Label htmlFor="reportDetail">Details (optional)</Label>
                        <Textarea id="reportDetail" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        isLoading={submit.isPending}
                        loadingText="Sending…"
                        onClick={() => submit.mutate()}
                    >
                        Send report
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
