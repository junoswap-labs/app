'use client'

import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { isAddress, parseUnits, formatUnits } from 'viem'
import type { Address } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { junoPtsAbi } from '@/lib/abis/juno-pts'
import { useSimulatedWrite } from '@/hooks/useSimulatedWrite'
import { useIsAdmin } from '@/hooks/useOnChainRoles'
import { toastError, toastSuccess } from '@/lib/toast'
import { useContractAddresses } from '@/hooks/useContractAddresses'

/**
 * Mint JPTS from the admin page. Two on-chain steps, because being ADMIN is not being MINTER:
 *   1. The DEFAULT_ADMIN_ROLE holder grants MINTER_ROLE (once per minting wallet).
 *   2. That wallet calls mint(to, amount).
 * JunoPts is plain 18-decimal ERC20 (no decimals() override), so amounts here are whole JPTS.
 */
export function JunoPtsMint() {
    const { junoPts: JPTS } = useContractAddresses()
    const { address } = useAccount()
    const isAdmin = useIsAdmin()
    const write = useSimulatedWrite()
    const [to, setTo] = useState('')
    const [amount, setAmount] = useState('')
    const [busy, setBusy] = useState<'grant' | 'mint' | null>(null)

    const { data: minterRole } = useReadContract({
        address: JPTS,
        abi: junoPtsAbi,
        functionName: 'MINTER_ROLE',
        query: { enabled: Boolean(JPTS) },
    })

    const { data: canMint, refetch: refetchRole } = useReadContract({
        address: JPTS,
        abi: junoPtsAbi,
        functionName: 'hasRole',
        args: minterRole && address ? [minterRole, address] : undefined,
        query: { enabled: Boolean(JPTS && minterRole && address) },
    })

    const recipient = isAddress(to) ? (to as Address) : undefined
    const { data: balance, refetch: refetchBalance } = useReadContract({
        address: JPTS,
        abi: junoPtsAbi,
        functionName: 'balanceOf',
        args: recipient ? [recipient] : undefined,
        query: { enabled: Boolean(JPTS && recipient) },
    })

    let units: bigint | undefined
    try {
        units = amount.trim() ? parseUnits(amount.trim(), 18) : undefined
    } catch {
        units = undefined
    }

    if (!JPTS) return <p className="text-sm text-muted-foreground">JunoPts is not deployed on this network.</p>

    const grant = async () => {
        if (!minterRole || !address) return
        setBusy('grant')
        try {
            await write({ address: JPTS, abi: junoPtsAbi, functionName: 'grantRole', args: [minterRole, address] })
            toastSuccess('MINTER_ROLE granted to this wallet')
            await refetchRole()
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'grant failed')
        } finally {
            setBusy(null)
        }
    }

    const mint = async () => {
        if (!recipient || !units) return
        setBusy('mint')
        try {
            await write({ address: JPTS, abi: junoPtsAbi, functionName: 'mint', args: [recipient, units] })
            toastSuccess(`Minted ${amount} JPTS`)
            await refetchBalance()
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'mint failed')
        } finally {
            setBusy(null)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">JunoPts · Mint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">This wallet:</span>
                    <Badge variant={canMint ? 'secondary' : 'outline'}>
                        {canMint ? 'Has MINTER_ROLE' : 'No MINTER_ROLE'}
                    </Badge>
                    {!canMint && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!isAdmin || !minterRole || busy !== null}
                            isLoading={busy === 'grant'}
                            onClick={grant}
                        >
                            Grant MINTER_ROLE to this wallet
                        </Button>
                    )}
                </div>
                {!isAdmin && <p className="text-xs text-muted-foreground">Connect an Admin wallet to grant the role.</p>}

                <div className="space-y-1.5">
                    <Label htmlFor="mintTo">Recipient</Label>
                    <div className="flex gap-2">
                        <Input
                            id="mintTo"
                            className="font-mono text-xs"
                            placeholder="0x…"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                        {address && (
                            <Button variant="outline" size="sm" onClick={() => setTo(address)}>
                                Me
                            </Button>
                        )}
                    </div>
                    {to && !recipient && <p className="text-xs text-destructive">Not a valid address.</p>}
                    {recipient && balance !== undefined && (
                        <p className="text-xs text-muted-foreground">Current balance: {formatUnits(balance, 18)} JPTS</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="mintAmount">Amount (JPTS)</Label>
                    <div className="flex gap-2">
                        <Input
                            id="mintAmount"
                            inputMode="decimal"
                            placeholder="30000"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <Button
                            disabled={!canMint || !recipient || !units || busy !== null}
                            isLoading={busy === 'mint'}
                            onClick={mint}
                        >
                            Mint
                        </Button>
                    </div>
                    {amount.trim() && !units && <p className="text-xs text-destructive">Not a valid amount.</p>}
                </div>
            </CardContent>
        </Card>
    )
}
