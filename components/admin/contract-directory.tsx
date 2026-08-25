'use client'

import { useState } from 'react'
import { useChainId, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, ExternalLink } from 'lucide-react'
import type { Address } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getExplorerAddressUrl } from '@/lib/explorer'
import { getChainMetadata } from '@/lib/wagmi'
import { getContractDirectory, type DirectoryEntry } from '@/lib/contract-addresses'

function AddressRow({ entry, checkCode }: { entry: DirectoryEntry; checkCode: boolean }) {
    const chainId = useChainId()
    const publicClient = usePublicClient()
    const [copied, setCopied] = useState(false)

    // A configured address that has no bytecode on the connected chain is the failure this page
    // exists to catch: an address left over from another network or an older deployment looks
    // perfectly fine in an env file, and every call to it silently reverts.
    const { data: hasCode } = useQuery({
        queryKey: ['contract-code', chainId, entry.address],
        enabled: checkCode && Boolean(entry.address && publicClient),
        staleTime: 5 * 60_000,
        queryFn: async () => {
            const code = await publicClient!.getCode({ address: entry.address as Address })
            return Boolean(code && code !== '0x')
        },
    })

    const copy = async () => {
        if (!entry.address) return
        await navigator.clipboard.writeText(entry.address)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.label}</span>
                    {!entry.address ? (
                        <Badge variant="outline">Not deployed</Badge>
                    ) : checkCode && hasCode === false ? (
                        <Badge variant="destructive">No contract at this address</Badge>
                    ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{entry.note}</p>
                <p className="font-mono text-[11px] text-muted-foreground/70">{entry.env}</p>
            </div>

            {entry.address && (
                <div className="flex shrink-0 items-center gap-1">
                    <span className="font-mono text-xs">
                        {entry.address.slice(0, 10)}…{entry.address.slice(-8)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={copy} aria-label={`Copy ${entry.label} address`}>
                        {copied ? <Check className="h-4 w-4 text-positive" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" asChild aria-label={`Open ${entry.label} in explorer`}>
                        <a href={getExplorerAddressUrl(chainId, entry.address)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </Button>
                </div>
            )}
        </div>
    )
}

export function ContractDirectory() {
    const chainId = useChainId()
    const chain = getChainMetadata(chainId)
    const { contractDirectory, walletDirectory } = getContractDirectory(chainId)

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Deployed contracts — {chain?.name ?? `chain ${chainId}`}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {contractDirectory.map((entry) => (
                        <AddressRow key={entry.env} entry={entry} checkCode />
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Protocol wallets</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {walletDirectory.map((entry) => (
                        <AddressRow key={entry.env} entry={entry} checkCode={false} />
                    ))}
                </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
                These come from config/contract-addresses.ts (keyed by chain id), not from the database — the same
                values the app itself calls. Changing one means editing that file and redeploying; a
                database-editable address would let this page and the running app disagree about where the money is.
            </p>
        </div>
    )
}
