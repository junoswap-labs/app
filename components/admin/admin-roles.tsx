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
import { useContractAddresses } from '@/hooks/useContractAddresses'

/**
 * Every role here is a `role => account => bool` mapping in OpenZeppelin's AccessControl, so any
 * number of wallets can hold each one at the same time and each grant/revoke is its own on-chain
 * tx. PermissionRegistry is plain AccessControl (not Enumerable), so current holders can't be
 * listed — check an address instead.
 */
const ROLES = [
    {
        key: 'admin',
        label: 'Admin',
        roleGetter: 'DEFAULT_ADMIN_ROLE',
        checker: 'isAdmin',
        description:
            'Full control: grants every other role, moves fees, pauses contracts. Revoking your own wallet takes effect immediately — keep another admin (ideally a multisig) before doing it.',
    },
    {
        key: 'authorize',
        label: 'Authorize (Registered)',
        roleGetter: 'AUTHORIZE_ROLE',
        checker: 'isAuthorized',
        description:
            'The "Registered" party. Required to list an RWA item, and it is what makes JunoPts move: a points transfer needs at least one Registered side, so any wallet or contract meant to receive points from ordinary holders — a merchant, an escrow — needs this.',
    },
    {
        key: 'partner-marketplace',
        label: 'Partner · Marketplace',
        roleGetter: 'PARTNER_MARKETPLACE_ROLE',
        checker: 'isPartnerMarketplace',
        description: 'Pre-vetted brand account: may register collections and list RWA without individual seller vetting.',
    },
    {
        key: 'partner-redeem',
        label: 'Partner · Redeem',
        roleGetter: 'PARTNER_REDEEM_ROLE',
        checker: 'isPartnerRedeem',
        description: 'May create Redeem catalog items. Independent of the Marketplace partner role — one does not imply the other.',
    },
] as const

export function AdminRoles() {
    const { permissionRegistry: REGISTRY_ADDRESS } = useContractAddresses()
    const isAdmin = useIsAdmin()
    const write = useSimulatedWrite()
    const [roleKey, setRoleKey] = useState<(typeof ROLES)[number]['key']>('authorize')
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState<'grant' | 'revoke' | null>(null)

    const role = ROLES.find((r) => r.key === roleKey) ?? ROLES[0]
    const candidate = isAddress(input) ? (input as Address) : undefined

    const { data: roleHash } = useReadContract({
        address: REGISTRY_ADDRESS,
        abi: permissionRegistryAbi,
        functionName: role.roleGetter,
        query: { enabled: Boolean(REGISTRY_ADDRESS) },
    })

    const { data: alreadyHas, refetch } = useReadContract({
        address: REGISTRY_ADDRESS,
        abi: permissionRegistryAbi,
        functionName: role.checker,
        args: candidate ? [candidate] : undefined,
        query: { enabled: Boolean(REGISTRY_ADDRESS && candidate) },
    })

    if (!REGISTRY_ADDRESS) {
        return <p className="text-sm text-muted-foreground">PermissionRegistry is not deployed yet.</p>
    }

    const run = async (action: 'grant' | 'revoke') => {
        if (!candidate || !roleHash) return
        setBusy(action)
        try {
            await write({
                address: REGISTRY_ADDRESS,
                abi: permissionRegistryAbi,
                functionName: action === 'grant' ? 'grantRole' : 'revokeRole',
                args: [roleHash, candidate],
            })
            toastSuccess(`${role.label} ${action === 'grant' ? 'granted' : 'revoked'}`)
            await refetch()
        } catch (err) {
            toastError(err instanceof Error ? err.message : `${action} failed`)
        } finally {
            setBusy(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">On-chain roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                    {ROLES.map((option) => (
                        <Button
                            key={option.key}
                            size="sm"
                            variant={option.key === roleKey ? 'default' : 'outline'}
                            onClick={() => setRoleKey(option.key)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>

                <p className="text-xs text-muted-foreground">{role.description}</p>

                <div className="space-y-1.5">
                    <Label htmlFor="roleWallet">Wallet or contract address</Label>
                    <div className="flex gap-2">
                        <Input
                            id="roleWallet"
                            className="font-mono text-xs"
                            placeholder="0x…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !candidate || alreadyHas === true || busy !== null}
                            isLoading={busy === 'grant'}
                            onClick={() => run('grant')}
                        >
                            Grant
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !candidate || alreadyHas === false || busy !== null}
                            isLoading={busy === 'revoke'}
                            onClick={() => run('revoke')}
                        >
                            Revoke
                        </Button>
                    </div>
                    {input && !candidate && <p className="text-xs text-destructive">Not a valid address.</p>}
                    {candidate && (
                        <Badge variant={alreadyHas ? 'secondary' : 'outline'}>
                            {alreadyHas ? `Has ${role.label}` : `Does not have ${role.label}`}
                        </Badge>
                    )}
                    {!isAdmin && <p className="text-xs text-muted-foreground">Connect an Admin wallet to change roles.</p>}
                </div>
            </CardContent>
        </Card>
    )
}
