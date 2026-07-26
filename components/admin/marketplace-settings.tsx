'use client'

import { useState } from 'react'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { nftMarketplaceAdminAbi } from '@/lib/abis/nft-marketplace'
import { rwaEscrowAdminAbi } from '@/lib/abis/rwa-escrow'
import { toastSuccess, toastError } from '@/lib/toast'

const NFT_MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS as Address | undefined
const RWA_ESCROW_ADDRESS = process.env.NEXT_PUBLIC_RWA_ESCROW_ADDRESS as Address | undefined

/**
 * Platform-level contract admin — fee/token-allowlist/pause controls that previously had zero UI
 * (an admin would have had to call these through a block explorer's "Write Contract" tab).
 *
 * Important: this is a DIFFERENT admin concept from PermissionRegistry's Admin role used
 * elsewhere on this page. NftMarketplace uses Ownable2Step's owner(); RwaEscrow uses
 * AccessControl's DEFAULT_ADMIN_ROLE. A PermissionRegistry admin is not necessarily the owner/
 * admin of either contract — each section below checks the CONNECTED wallet against that
 * specific contract's own on-chain admin, live, and disables its buttons if it doesn't match.
 * As always, this is UX only: the contract's own onlyOwner/onlyRole modifier is what actually
 * enforces it — a mismatched wallet's tx would simply revert.
 */
export function MarketplaceSettings() {
    if (!NFT_MARKETPLACE_ADDRESS && !RWA_ESCROW_ADDRESS) {
        return (
            <EmptyState
                title="No contracts deployed yet"
                description="NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS / NEXT_PUBLIC_RWA_ESCROW_ADDRESS aren't set."
            />
        )
    }

    return (
        <div className="space-y-6">
            {NFT_MARKETPLACE_ADDRESS && <NftMarketplaceSettings address={NFT_MARKETPLACE_ADDRESS} />}
            {RWA_ESCROW_ADDRESS && <RwaEscrowSettings address={RWA_ESCROW_ADDRESS} />}
        </div>
    )
}

function AdminBadge({ isAdmin }: { isAdmin: boolean }) {
    return (
        <Badge variant={isAdmin ? 'secondary' : 'outline'}>
            {isAdmin ? 'you are the admin' : 'not the admin'}
        </Badge>
    )
}

function NftMarketplaceSettings({ address }: { address: Address }) {
    const { address: wallet } = useAccount()
    const publicClient = usePublicClient()
    const { writeContractAsync } = useWriteContract()
    const [busy, setBusy] = useState<string | null>(null)

    const { data: owner, refetch: refetchOwner } = useReadContract({
        address,
        abi: nftMarketplaceAdminAbi,
        functionName: 'owner',
    })
    const { data: paused, refetch: refetchPaused } = useReadContract({
        address,
        abi: nftMarketplaceAdminAbi,
        functionName: 'paused',
    })
    const { data: feeBps, refetch: refetchFeeBps } = useReadContract({
        address,
        abi: nftMarketplaceAdminAbi,
        functionName: 'feeBps',
    })
    const { data: feeCollector, refetch: refetchFeeCollector } = useReadContract({
        address,
        abi: nftMarketplaceAdminAbi,
        functionName: 'feeCollector',
    })
    const { data: maxFeeBps } = useReadContract({
        address,
        abi: nftMarketplaceAdminAbi,
        functionName: 'MAX_FEE_BPS',
    })

    const isAdmin = Boolean(wallet && owner && wallet.toLowerCase() === owner.toLowerCase())

    const [feeBpsInput, setFeeBpsInput] = useState('')
    const [feeCollectorInput, setFeeCollectorInput] = useState('')
    const [tokenInput, setTokenInput] = useState('')

    const run = async (key: string, fn: () => Promise<`0x${string}`>) => {
        setBusy(key)
        try {
            const hash = await fn()
            await publicClient?.waitForTransactionReceipt({ hash })
            toastSuccess('Updated')
            await Promise.all([refetchOwner(), refetchPaused(), refetchFeeBps(), refetchFeeCollector()])
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Transaction failed')
        } finally {
            setBusy(null)
        }
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">NftMarketplace</CardTitle>
                <AdminBadge isAdmin={isAdmin} />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                        <p className="text-sm font-medium">Trading {paused ? 'paused' : 'active'}</p>
                        <p className="text-xs text-muted-foreground">Emergency stop for all listings/fulfillments</p>
                    </div>
                    <Button
                        size="sm"
                        variant={paused ? 'default' : 'destructive'}
                        disabled={!isAdmin || busy !== null}
                        isLoading={busy === 'pause'}
                        onClick={() =>
                            run('pause', () =>
                                writeContractAsync({
                                    address,
                                    abi: nftMarketplaceAdminAbi,
                                    functionName: paused ? 'unpause' : 'pause',
                                })
                            )
                        }
                    >
                        {paused ? 'Unpause' : 'Pause'}
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Platform fee (bps)</Label>
                        <p className="text-xs text-muted-foreground">
                            Current: {feeBps?.toString() ?? '—'} / max {maxFeeBps?.toString() ?? '—'}
                        </p>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min="0"
                                placeholder={feeBps?.toString()}
                                value={feeBpsInput}
                                onChange={(e) => setFeeBpsInput(e.target.value)}
                            />
                            <Button
                                disabled={!isAdmin || !feeBpsInput || busy !== null}
                                isLoading={busy === 'feeBps'}
                                onClick={() =>
                                    run('feeBps', () =>
                                        writeContractAsync({
                                            address,
                                            abi: nftMarketplaceAdminAbi,
                                            functionName: 'setFeeBps',
                                            args: [BigInt(feeBpsInput)],
                                        })
                                    )
                                }
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Fee collector</Label>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                            {feeCollector ?? '—'}
                        </p>
                        <div className="flex gap-2">
                            <Input
                                className="font-mono text-xs"
                                placeholder="0x…"
                                value={feeCollectorInput}
                                onChange={(e) => setFeeCollectorInput(e.target.value)}
                            />
                            <Button
                                disabled={!isAdmin || !feeCollectorInput || busy !== null}
                                isLoading={busy === 'feeCollector'}
                                onClick={() =>
                                    run('feeCollector', () =>
                                        writeContractAsync({
                                            address,
                                            abi: nftMarketplaceAdminAbi,
                                            functionName: 'setFeeCollector',
                                            args: [feeCollectorInput as Address],
                                        })
                                    )
                                }
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label>Allow a payment token</Label>
                    <div className="flex gap-2">
                        <Input
                            className="font-mono text-xs"
                            placeholder="0x… ERC20 address"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                        />
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !tokenInput || busy !== null}
                            isLoading={busy === 'allow'}
                            onClick={() =>
                                run('allow', () =>
                                    writeContractAsync({
                                        address,
                                        abi: nftMarketplaceAdminAbi,
                                        functionName: 'setAllowedPaymentToken',
                                        args: [tokenInput as Address, true],
                                    })
                                )
                            }
                        >
                            Allow
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !tokenInput || busy !== null}
                            isLoading={busy === 'disallow'}
                            onClick={() =>
                                run('disallow', () =>
                                    writeContractAsync({
                                        address,
                                        abi: nftMarketplaceAdminAbi,
                                        functionName: 'setAllowedPaymentToken',
                                        args: [tokenInput as Address, false],
                                    })
                                )
                            }
                        >
                            Disallow
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function RwaEscrowSettings({ address }: { address: Address }) {
    const { address: wallet } = useAccount()
    const publicClient = usePublicClient()
    const { writeContractAsync } = useWriteContract()
    const [busy, setBusy] = useState<string | null>(null)

    const { data: adminRole } = useReadContract({
        address,
        abi: rwaEscrowAdminAbi,
        functionName: 'DEFAULT_ADMIN_ROLE',
    })
    const { data: arbitratorRole } = useReadContract({
        address,
        abi: rwaEscrowAdminAbi,
        functionName: 'ARBITRATOR_ROLE',
    })
    const { data: isAdminOnChain, refetch: refetchIsAdmin } = useReadContract({
        address,
        abi: rwaEscrowAdminAbi,
        functionName: 'hasRole',
        args: adminRole && wallet ? [adminRole, wallet] : undefined,
        query: { enabled: Boolean(adminRole && wallet) },
    })
    const { data: paused, refetch: refetchPaused } = useReadContract({
        address,
        abi: rwaEscrowAdminAbi,
        functionName: 'paused',
    })
    const { data: feeBps, refetch: refetchFeeBps } = useReadContract({
        address,
        abi: rwaEscrowAdminAbi,
        functionName: 'feeBps',
    })
    const { data: feeCollector, refetch: refetchFeeCollector } = useReadContract({
        address,
        abi: rwaEscrowAdminAbi,
        functionName: 'feeCollector',
    })
    const { data: maxFeeBps } = useReadContract({
        address,
        abi: rwaEscrowAdminAbi,
        functionName: 'MAX_FEE_BPS',
    })

    const isAdmin = Boolean(isAdminOnChain)

    const [feeBpsInput, setFeeBpsInput] = useState('')
    const [feeCollectorInput, setFeeCollectorInput] = useState('')
    const [tokenInput, setTokenInput] = useState('')
    const [arbitratorInput, setArbitratorInput] = useState('')

    const run = async (key: string, fn: () => Promise<`0x${string}`>) => {
        setBusy(key)
        try {
            const hash = await fn()
            await publicClient?.waitForTransactionReceipt({ hash })
            toastSuccess('Updated')
            await Promise.all([refetchIsAdmin(), refetchPaused(), refetchFeeBps(), refetchFeeCollector()])
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Transaction failed')
        } finally {
            setBusy(null)
        }
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">RwaEscrow</CardTitle>
                <AdminBadge isAdmin={isAdmin} />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                        <p className="text-sm font-medium">Escrow {paused ? 'paused' : 'active'}</p>
                        <p className="text-xs text-muted-foreground">
                            Emergency stop — disputes can still be resolved while paused
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant={paused ? 'default' : 'destructive'}
                        disabled={!isAdmin || busy !== null}
                        isLoading={busy === 'pause'}
                        onClick={() =>
                            run('pause', () =>
                                writeContractAsync({
                                    address,
                                    abi: rwaEscrowAdminAbi,
                                    functionName: paused ? 'unpause' : 'pause',
                                })
                            )
                        }
                    >
                        {paused ? 'Unpause' : 'Pause'}
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Platform fee (bps)</Label>
                        <p className="text-xs text-muted-foreground">
                            Current: {feeBps?.toString() ?? '—'} / max {maxFeeBps?.toString() ?? '—'}
                        </p>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min="0"
                                placeholder={feeBps?.toString()}
                                value={feeBpsInput}
                                onChange={(e) => setFeeBpsInput(e.target.value)}
                            />
                            <Button
                                disabled={!isAdmin || !feeBpsInput || busy !== null}
                                isLoading={busy === 'feeBps'}
                                onClick={() =>
                                    run('feeBps', () =>
                                        writeContractAsync({
                                            address,
                                            abi: rwaEscrowAdminAbi,
                                            functionName: 'setFeeBps',
                                            args: [BigInt(feeBpsInput)],
                                        })
                                    )
                                }
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Fee collector</Label>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                            {feeCollector ?? '—'}
                        </p>
                        <div className="flex gap-2">
                            <Input
                                className="font-mono text-xs"
                                placeholder="0x…"
                                value={feeCollectorInput}
                                onChange={(e) => setFeeCollectorInput(e.target.value)}
                            />
                            <Button
                                disabled={!isAdmin || !feeCollectorInput || busy !== null}
                                isLoading={busy === 'feeCollector'}
                                onClick={() =>
                                    run('feeCollector', () =>
                                        writeContractAsync({
                                            address,
                                            abi: rwaEscrowAdminAbi,
                                            functionName: 'setFeeCollector',
                                            args: [feeCollectorInput as Address],
                                        })
                                    )
                                }
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label>Allow a payment token</Label>
                    <div className="flex gap-2">
                        <Input
                            className="font-mono text-xs"
                            placeholder="0x… ERC20 address"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                        />
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !tokenInput || busy !== null}
                            isLoading={busy === 'allow'}
                            onClick={() =>
                                run('allow', () =>
                                    writeContractAsync({
                                        address,
                                        abi: rwaEscrowAdminAbi,
                                        functionName: 'setAllowedPaymentToken',
                                        args: [tokenInput as Address, true],
                                    })
                                )
                            }
                        >
                            Allow
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !tokenInput || busy !== null}
                            isLoading={busy === 'disallow'}
                            onClick={() =>
                                run('disallow', () =>
                                    writeContractAsync({
                                        address,
                                        abi: rwaEscrowAdminAbi,
                                        functionName: 'setAllowedPaymentToken',
                                        args: [tokenInput as Address, false],
                                    })
                                )
                            }
                        >
                            Disallow
                        </Button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label>Arbitrator (resolves disputes)</Label>
                    <div className="flex gap-2">
                        <Input
                            className="font-mono text-xs"
                            placeholder="0x…"
                            value={arbitratorInput}
                            onChange={(e) => setArbitratorInput(e.target.value)}
                        />
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !arbitratorInput || !arbitratorRole || busy !== null}
                            isLoading={busy === 'grantArb'}
                            onClick={() =>
                                run('grantArb', () =>
                                    writeContractAsync({
                                        address,
                                        abi: rwaEscrowAdminAbi,
                                        functionName: 'grantRole',
                                        args: [arbitratorRole!, arbitratorInput as Address],
                                    })
                                )
                            }
                        >
                            Grant
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!isAdmin || !arbitratorInput || !arbitratorRole || busy !== null}
                            isLoading={busy === 'revokeArb'}
                            onClick={() =>
                                run('revokeArb', () =>
                                    writeContractAsync({
                                        address,
                                        abi: rwaEscrowAdminAbi,
                                        functionName: 'revokeRole',
                                        args: [arbitratorRole!, arbitratorInput as Address],
                                    })
                                )
                            }
                        >
                            Revoke
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Should be a multisig, never a single EOA — it can move other people&apos;s
                        escrowed funds when resolving a dispute.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
