'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { useIsAdmin, useIsPartnerMarketplace } from '@/hooks/useOnChainRoles'
import { useRegisterCollection } from '@/hooks/useCollections'
import { toastSuccess, toastError } from '@/lib/toast'

// ERC-165 interface id for ERC-721 (0x80ac58cd) — a quick client-side sanity check that the
// contract at least looks like an NFT before it's registered, not a substitute for real review.
const ERC721_INTERFACE_ID = '0x80ac58cd'

export default function RegisterCollectionPage() {
    const router = useRouter()
    const { isConnected } = useAccount()
    const chainId = useChainId()
    const isAdmin = useIsAdmin()
    const isPartnerMarketplace = useIsPartnerMarketplace()
    const register = useRegisterCollection()

    const [form, setForm] = useState({ contract: '', name: '', displayName: '', gateway: '' })

    const contractLooksValid = /^0x[a-fA-F0-9]{40}$/.test(form.contract.trim())
    const { data: supportsErc721, isLoading: probing } = useReadContract({
        address: contractLooksValid ? (form.contract.trim() as `0x${string}`) : undefined,
        abi: [
            {
                type: 'function',
                name: 'supportsInterface',
                stateMutability: 'view',
                inputs: [{ name: 'interfaceId', type: 'bytes4' }],
                outputs: [{ type: 'bool' }],
            },
        ] as const,
        functionName: 'supportsInterface',
        args: [ERC721_INTERFACE_ID],
        query: { enabled: contractLooksValid },
    })

    if (!isConnected) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <EmptyState
                    title="Connect your wallet"
                    description="Registering a collection is tied to your wallet address."
                />
            </div>
        )
    }

    if (!isAdmin && !isPartnerMarketplace) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <ShieldAlert className="h-8 w-8 text-primary" />
                        <h2 className="text-lg font-semibold tracking-tight">
                            Marketplace Partner rights required
                        </h2>
                        <p className="max-w-md text-sm text-muted-foreground">
                            Registering a new collection requires Admin or Marketplace Partner
                            rights. Apply for Partner access to register your own project.
                        </p>
                        <Button asChild className="mt-1">
                            <Link href="/app/partner/apply">Apply as a Partner</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const incomplete = !contractLooksValid || !form.name.trim()

    return (
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Register a Collection</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Only registered NFT contracts can be listed on the marketplace.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Collection details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="contract">Contract address</Label>
                        <Input
                            id="contract"
                            className="font-mono text-xs"
                            value={form.contract}
                            onChange={(e) => setForm({ ...form, contract: e.target.value })}
                        />
                        {contractLooksValid && !probing && supportsErc721 === false && (
                            <p className="text-xs text-destructive">
                                This contract doesn&apos;t implement ERC-721 — double check the address.
                            </p>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="displayName">Display name (optional)</Label>
                        <Input
                            id="displayName"
                            value={form.displayName}
                            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="gateway">Custom IPFS gateway (optional)</Label>
                        <Input
                            id="gateway"
                            placeholder="https://…"
                            value={form.gateway}
                            onChange={(e) => setForm({ ...form, gateway: e.target.value })}
                        />
                    </div>
                    <Button
                        className="w-full"
                        disabled={incomplete || register.isPending}
                        isLoading={register.isPending}
                        loadingText="Registering…"
                        onClick={() =>
                            register.mutate(
                                {
                                    contract: form.contract.trim(),
                                    chainId,
                                    name: form.name.trim(),
                                    displayName: form.displayName.trim() || undefined,
                                    gateway: form.gateway.trim() || undefined,
                                },
                                {
                                    onSuccess: () => {
                                        toastSuccess('Collection registered')
                                        router.push(`/app/collections/${form.contract.trim().toLowerCase()}`)
                                    },
                                    onError: (err) => toastError(err.message),
                                }
                            )
                        }
                    >
                        Register collection
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
