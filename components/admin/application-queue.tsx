'use client'

import { useState } from 'react'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { permissionRegistryAbi } from '@/lib/abis/permission-registry'
import { useAdminApplications, useReviewApplication } from '@/hooks/useApplications'
import { toastSuccess, toastError } from '@/lib/toast'
import type { Application, ApplicationKind } from '@/types/applications'

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_PERMISSION_REGISTRY_ADDRESS as Address | undefined

const ROLE_FN = {
    authorize_rwa: 'AUTHORIZE_ROLE',
    partner_marketplace: 'PARTNER_MARKETPLACE_ROLE',
    partner_redeem: 'PARTNER_REDEEM_ROLE',
} as const satisfies Record<ApplicationKind, string>

function shortAddr(addr: string) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

interface ApplicationQueueProps {
    kind: ApplicationKind
    title: string
    emptyDescription: string
    renderPayload: (application: Application) => React.ReactNode
}

/**
 * Generalizes the old per-kind KYC queue into one component used for all three approval flows.
 * Approve is a two-step Clean Workflow action: PermissionRegistry.grantRole (on-chain, real grant)
 * → then PATCH the application row (DB audit trail only) — never the reverse, and the DB flip
 * never happens if the on-chain tx fails.
 */
export function ApplicationQueue({ kind, title, emptyDescription, renderPayload }: ApplicationQueueProps) {
    const { address: reviewer } = useAccount()
    const publicClient = usePublicClient()
    const { data: applications } = useAdminApplications(kind)
    const { data: roleHash } = useReadContract({
        address: REGISTRY_ADDRESS,
        abi: permissionRegistryAbi,
        functionName: ROLE_FN[kind],
        query: { enabled: Boolean(REGISTRY_ADDRESS) },
    })
    const { writeContractAsync } = useWriteContract()
    const review = useReviewApplication()
    const [busyId, setBusyId] = useState<string | null>(null)

    const approve = async (application: Application) => {
        if (!REGISTRY_ADDRESS || !roleHash || !publicClient) {
            toastError('PermissionRegistry is not configured yet')
            return
        }
        setBusyId(application.id)
        try {
            const hash = await writeContractAsync({
                address: REGISTRY_ADDRESS,
                abi: permissionRegistryAbi,
                functionName: 'grantRole',
                args: [roleHash, application.wallet_address as Address],
            })
            await publicClient.waitForTransactionReceipt({ hash })
            await review.mutateAsync({ id: application.id, status: 'approved' })
            toastSuccess(`${shortAddr(application.wallet_address)} approved on-chain`)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Approval failed')
        } finally {
            setBusyId(null)
        }
    }

    const reject = async (application: Application) => {
        setBusyId(application.id)
        try {
            await review.mutateAsync({
                id: application.id,
                status: 'rejected',
                rejectReason: 'Rejected by reviewer',
            })
            toastSuccess(`${shortAddr(application.wallet_address)} rejected`)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Rejection failed')
        } finally {
            setBusyId(null)
        }
    }

    if (!applications || applications.length === 0) {
        return <EmptyState title={`No pending ${title.toLowerCase()} applications`} description={emptyDescription} />
    }

    return (
        <div className="space-y-3">
            {applications.map((application) => (
                <Card key={application.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono">
                                    {shortAddr(application.wallet_address)}
                                </Badge>
                            </div>
                            {renderPayload(application)}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                disabled={busyId === application.id || !reviewer}
                                isLoading={busyId === application.id}
                                loadingText="Approving on-chain…"
                                onClick={() => approve(application)}
                            >
                                Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                disabled={busyId === application.id}
                                onClick={() => reject(application)}
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
