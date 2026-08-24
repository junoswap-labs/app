'use client'

import { useState } from 'react'
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import type { Address } from 'viem'
import { Check, Copy, ExternalLink, Gavel, Pause, Percent, Play, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { nftMarketplaceAdminAbi } from '@/lib/abis/nft-marketplace'
import { rwaEscrowAdminAbi } from '@/lib/abis/rwa-escrow'
import { toastSuccess, toastError } from '@/lib/toast'
import { getExplorerAddressUrl } from '@/lib/explorer'
import { useContractAddresses } from '@/hooks/useContractAddresses'

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
    const {
        nftMarketplace: NFT_MARKETPLACE_ADDRESS,
        rwaEscrow: RWA_ESCROW_ADDRESS,
        redeemRwaEscrow: REDEEM_RWA_ESCROW_ADDRESS,
    } = useContractAddresses()
    if (!NFT_MARKETPLACE_ADDRESS && !RWA_ESCROW_ADDRESS && !REDEEM_RWA_ESCROW_ADDRESS) {
        return (
            <EmptyState
                title="No contracts deployed yet"
                description="NEXT_PUBLIC_NFT_MARKETPLACE_ADDRESS / NEXT_PUBLIC_RWA_ESCROW_ADDRESS aren't set."
            />
        )
    }

    return (
        <div className="space-y-6">
            {NFT_MARKETPLACE_ADDRESS && (
                <NftMarketplaceSettings address={NFT_MARKETPLACE_ADDRESS} title="NftMarketplace" />
            )}
            {RWA_ESCROW_ADDRESS && <RwaEscrowSettings address={RWA_ESCROW_ADDRESS} title="RwaEscrow · Marketplace" />}
            {REDEEM_RWA_ESCROW_ADDRESS && (
                <RwaEscrowSettings address={REDEEM_RWA_ESCROW_ADDRESS} title="RwaEscrow · Redeem" />
            )}
        </div>
    )
}

/** Shortened address + copy + explorer-link, matching contract-directory.tsx's AddressRow. */
function AddressChip({ address }: { address: Address }) {
    const chainId = useChainId()
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        await navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="flex shrink-0 items-center gap-0.5 rounded-md border bg-muted/30 pl-2.5">
            <span className="font-mono text-xs text-muted-foreground">
                {address.slice(0, 8)}…{address.slice(-6)}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy} aria-label="Copy contract address">
                {copied ? <Check className="h-3.5 w-3.5 text-positive" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild aria-label="Open in explorer">
                <a href={getExplorerAddressUrl(chainId, address)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>
            </Button>
        </div>
    )
}

function AdminBadge({ isAdmin }: { isAdmin: boolean }) {
    return (
        <Badge variant={isAdmin ? 'secondary' : 'outline'} className="shrink-0">
            {isAdmin ? 'you are the admin' : 'not the admin'}
        </Badge>
    )
}

/** Section label used above each group of controls (Emergency stop / Fees / Payment tokens / …). */
function SectionHeading({ icon: Icon, title, description }: { icon: typeof Pause; title: string; description: string }) {
    return (
        <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </div>
    )
}

function ConnectWalletNote({ show }: { show: boolean }) {
    if (!show) return null
    return <p className="text-xs text-muted-foreground">Connect a wallet to see whether it can manage this contract.</p>
}

function NftMarketplaceSettings({ address, title }: { address: Address; title: string }) {
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
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <AddressChip address={address} />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={paused ? 'destructive' : 'secondary'}>{paused ? 'Paused' : 'Active'}</Badge>
                    <AdminBadge isAdmin={isAdmin} />
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <ConnectWalletNote show={!wallet} />

                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <SectionHeading
                        icon={paused ? Play : Pause}
                        title={`Trading ${paused ? 'paused' : 'active'}`}
                        description="Emergency stop for all listings/fulfillments"
                    />
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

                <Separator />

                <div className="space-y-3">
                    <SectionHeading icon={Percent} title="Fees" description="Platform cut and where it's sent" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Platform fee (bps)</Label>
                            <p className="text-xs text-muted-foreground">
                                Current: <span className="font-mono">{feeBps?.toString() ?? '—'}</span> / max{' '}
                                <span className="font-mono">{maxFeeBps?.toString() ?? '—'}</span>
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
                                    disabled={!isAdmin || !feeBpsInput || feeBpsInput === feeBps?.toString() || busy !== null}
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
                            <p className="truncate font-mono text-xs text-muted-foreground">{feeCollector ?? '—'}</p>
                            <div className="flex gap-2">
                                <Input
                                    className="font-mono text-xs"
                                    placeholder={feeCollector ?? '0x…'}
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
                </div>

                <Separator />

                <div className="space-y-3">
                    <SectionHeading
                        icon={Wallet}
                        title="Payment tokens"
                        description="Only allow-listed ERC20s can be used to pay for a listing"
                    />
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

function RwaEscrowSettings({ address, title = 'RwaEscrow' }: { address: Address; title?: string }) {
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
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <AddressChip address={address} />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={paused ? 'destructive' : 'secondary'}>{paused ? 'Paused' : 'Active'}</Badge>
                    <AdminBadge isAdmin={isAdmin} />
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <ConnectWalletNote show={!wallet} />

                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <SectionHeading
                        icon={paused ? Play : Pause}
                        title={`Escrow ${paused ? 'paused' : 'active'}`}
                        description="Emergency stop — disputes can still be resolved while paused"
                    />
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

                <Separator />

                <div className="space-y-3">
                    <SectionHeading icon={Percent} title="Fees" description="Platform cut and where it's sent" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Platform fee (bps)</Label>
                            <p className="text-xs text-muted-foreground">
                                Current: <span className="font-mono">{feeBps?.toString() ?? '—'}</span> / max{' '}
                                <span className="font-mono">{maxFeeBps?.toString() ?? '—'}</span>
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
                                    disabled={!isAdmin || !feeBpsInput || feeBpsInput === feeBps?.toString() || busy !== null}
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
                            <p className="truncate font-mono text-xs text-muted-foreground">{feeCollector ?? '—'}</p>
                            <div className="flex gap-2">
                                <Input
                                    className="font-mono text-xs"
                                    placeholder={feeCollector ?? '0x…'}
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
                </div>

                <Separator />

                <div className="space-y-3">
                    <SectionHeading
                        icon={Wallet}
                        title="Payment tokens"
                        description="Only allow-listed ERC20s can fund this escrow"
                    />
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

                <Separator />

                <div className="space-y-3">
                    <SectionHeading icon={Gavel} title="Dispute arbitrator" description="Resolves opened disputes" />
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
                        Should be a multisig, never a single EOA — it can move other people&apos;s escrowed funds when
                        resolving a dispute.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
