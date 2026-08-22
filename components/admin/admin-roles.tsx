'use client'

import { useState } from 'react'
import { useReadContract } from 'wagmi'
import { isAddress } from 'viem'
import type { Address } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { permissionRegistryAbi } from '@/lib/abis/permission-registry'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import { useIsAdmin } from '@/hooks/useOnChainRoles'
import { toastError, toastSuccess } from '@/lib/toast'

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_PERMISSION_REGISTRY_ADDRESS as Address | undefined

/**
 * Admin is `DEFAULT_ADMIN_ROLE` on PermissionRegistry, which OpenZeppelin's AccessControl stores as
 * a `role => account => bool` mapping — so any number of wallets can hold it simultaneously, and
 * each grant/revoke is its own on-chain tx from an existing admin. There is no enumeration on this
 * contract (plain AccessControl, not AccessControlEnumerable), so the current holders can't be
 * listed here; check an address below instead.
 */
export function AdminRoles() {
    const isAdmin = useIsAdmin()
    const write = useSimulatedWrite()
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState<'grant' | 'revoke' | null>(null)

    const candidate = isAddress(input) ? (input as Address) : undefined

    const { data: adminRole } = useReadContract({
        address: REGISTRY_ADDRESS,
        abi: permissionRegistryAbi,
        functionName: 'DEFAULT_ADMIN_ROLE',
        query: { enabled: Boolean(REGISTRY_ADDRESS) },
    })

    const { data: alreadyAdmin, refetch } = useReadContract({
        address: REGISTRY_ADDRESS,
        abi: permissionRegistryAbi,
        functionName: 'isAdmin',
        args: candidate ? [candidate] : undefined,
        query: { enabled: Boolean(REGISTRY_ADDRESS && candidate) },
    })

    const run = async (action: 'grant' | 'revoke') => {
        if (!REGISTRY_ADDRESS || !candidate || !adminRole) return
        setBusy(action)
        try {
            await write({
                address: REGISTRY_ADDRESS,
                abi: permissionRegistryAbi,
                functionName: action === 'grant' ? 'grantRole' : 'revokeRole',
                args: [adminRole, candidate],
            })
            toastSuccess(action === 'grant' ? 'Admin granted' : 'Admin revoked')
            await refetch()
        } catch (err) {
            toastError(err instanceof Error ? err.message : `${action} failed`)
        } finally {
            setBusy(null)
        }
    }

    if (!REGISTRY_ADDRESS) {
        return <p className="text-sm text-muted-foreground">PermissionRegistry is not deployed yet.</p>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Admin accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1.5">
                    <Label htmlFor="adminWallet">Wallet address</Label>
                    <div className="flex gap-2">
                        <Input
                            id="adminWallet"
                            className="font-mono text-xs"
                            placeholder="0x…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !candidate || alreadyAdmin === true || busy !== null}
                            isLoading={busy === 'grant'}
                            onClick={() => run('grant')}
                        >
                            Grant
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !candidate || alreadyAdmin === false || busy !== null}
                            isLoading={busy === 'revoke'}
                            onClick={() => run('revoke')}
                        >
                            Revoke
                        </Button>
                    </div>
                    {input && !candidate && <p className="text-xs text-destructive">Not a valid address.</p>}
                    {candidate && (
                        <Badge variant={alreadyAdmin ? 'secondary' : 'outline'}>
                            {alreadyAdmin ? 'Currently an admin' : 'Not an admin'}
                        </Badge>
                    )}
                </div>

                <p className="text-xs text-muted-foreground">
                    Any number of wallets can hold Admin at once. Revoking your own wallet takes effect immediately —
                    keep at least one other admin (ideally a multisig) before doing it, or nobody can grant the role
                    back.
                </p>
            </CardContent>
        </Card>
    )
}
