'use client'

import { formatUnits } from 'viem'
import type { Address } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { AirdropGasMode } from '@/types/airdrop'

export function StepGas({
    limited,
    gasMode,
    setGasMode,
    relayerAddress,
    gasDepositPreview,
}: {
    limited: boolean
    gasMode: AirdropGasMode
    setGasMode: (v: AirdropGasMode) => void
    relayerAddress: Address | undefined
    gasDepositPreview: bigint | null
}) {
    if (!limited) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Claimers pay their own gas.</span> Unlimited campaigns can&apos;t use
                        the &quot;I pay gas for claimers&quot; option — it escrows gas per claim slot, which needs a fixed number of
                        claimants. Switch to Limited above to enable it.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Who pays gas to claim?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <RadioGroup value={gasMode} onValueChange={(v) => setGasMode(v as AirdropGasMode)} className="grid-cols-1">
                    <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                        <RadioGroupItem value="self" id="gas-self" className="mt-0.5" />
                        <span>
                            <span className="font-medium">Claimers pay their own gas</span>
                            <br />
                            <span className="text-muted-foreground">No deposit needed from you.</span>
                        </span>
                    </label>
                    <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                        <RadioGroupItem value="relayer" id="gas-relayer" className="mt-0.5" />
                        <span>
                            <span className="font-medium">I pay gas for claimers</span>
                            <br />
                            <span className="text-muted-foreground">
                                Claimers pay nothing. You need to deposit KUB to the relayer wallet to cover their gas.
                            </span>
                        </span>
                    </label>
                </RadioGroup>
                {gasMode === 'relayer' && (
                    <div className="space-y-1.5">
                        {relayerAddress ? (
                            <p className="text-xs text-muted-foreground">
                                {gasDepositPreview != null
                                    ? `Estimated gas deposit: ~${formatUnits(gasDepositPreview, 18)} KUB, held in the campaign contract and refundable via "Reclaim gas" once the campaign ends.`
                                    : 'Set a limited number of claimants to see the estimated gas deposit.'}
                            </p>
                        ) : (
                            <p className="text-xs text-destructive">The relayer service is not configured yet — ask an admin.</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
