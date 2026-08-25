'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { cn } from '@/lib/utils'
import type { AirdropAmountMode } from '@/types/airdrop'

export function StepTokenAmount({
    tokenAddress,
    setTokenAddress,
    validToken,
    tokenSymbol,
    tokenDecimals,
    tokenMetaLoaded,
    amountMode,
    setAmountMode,
    fixedAmount,
    setFixedAmount,
    minAmount,
    setMinAmount,
    maxAmount,
    setMaxAmount,
    limited,
    setLimited,
    maxClaimants,
    setMaxClaimants,
    totalAmount,
    setTotalAmount,
    totalReadOnly,
    totalTooLowForRandom,
    totalHelperText,
    preview,
    hasExpiry,
    setHasExpiry,
    expiresAt,
    setExpiresAt,
}: {
    tokenAddress: string
    setTokenAddress: (v: string) => void
    validToken: boolean
    tokenSymbol: string | undefined
    tokenDecimals: number | undefined
    tokenMetaLoaded: boolean
    amountMode: AirdropAmountMode
    setAmountMode: (v: AirdropAmountMode) => void
    fixedAmount: string
    setFixedAmount: (v: string) => void
    minAmount: string
    setMinAmount: (v: string) => void
    maxAmount: string
    setMaxAmount: (v: string) => void
    limited: boolean
    setLimited: (v: boolean) => void
    maxClaimants: string
    setMaxClaimants: (v: string) => void
    totalAmount: string
    setTotalAmount: (v: string) => void
    totalReadOnly: boolean
    totalTooLowForRandom: boolean
    totalHelperText: string
    preview: string | null
    hasExpiry: boolean
    setHasExpiry: (v: boolean) => void
    expiresAt: string
    setExpiresAt: (v: string) => void
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Token &amp; amount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="token">Token contract address</Label>
                    <Input id="token" placeholder="0x…" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value.trim())} />
                    {validToken && tokenSymbol && tokenDecimals != null && (
                        <p className="text-xs text-muted-foreground">
                            Detected: {tokenSymbol} ({tokenDecimals} decimals)
                        </p>
                    )}
                    {validToken && tokenMetaLoaded && !tokenSymbol && (
                        <p className="text-xs text-destructive">Couldn&apos;t read this token — check the address and chain.</p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label>Distribution</Label>
                    <RadioGroup value={amountMode} onValueChange={(v) => setAmountMode(v as AirdropAmountMode)} className="grid-cols-1 sm:grid-cols-2">
                        <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                            <RadioGroupItem value="fixed" id="mode-fixed" />
                            Fixed amount
                        </label>
                        <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                            <RadioGroupItem value="random" id="mode-random" />
                            Random amount
                        </label>
                    </RadioGroup>
                </div>

                {amountMode === 'fixed' ? (
                    <div className="space-y-1.5">
                        <Label htmlFor="fixedAmount">Amount per claim{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                        <Input id="fixedAmount" type="number" min="0" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="minAmount">Min per claim{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                            <Input id="minAmount" type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="maxAmount">Max per claim{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                            <Input id="maxAmount" type="number" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label>Number of claimants</Label>
                    <RadioGroup value={limited ? 'limited' : 'unlimited'} onValueChange={(v) => setLimited(v === 'limited')} className="grid-cols-1 sm:grid-cols-2">
                        <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                            <RadioGroupItem value="limited" id="claimants-limited" />
                            Limited
                        </label>
                        <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                            <RadioGroupItem value="unlimited" id="claimants-unlimited" />
                            Unlimited (until it runs out)
                        </label>
                    </RadioGroup>
                    {limited && (
                        <Input
                            type="number"
                            min="1"
                            placeholder="Number of people"
                            value={maxClaimants}
                            onChange={(e) => setMaxClaimants(e.target.value)}
                        />
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="totalAmount">Total giveaway amount{tokenSymbol ? ` (${tokenSymbol})` : ''}</Label>
                    <Input
                        id="totalAmount"
                        type="number"
                        min="0"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        readOnly={totalReadOnly}
                        className={cn(totalTooLowForRandom && 'border-destructive focus-visible:ring-destructive')}
                    />
                    <p className={cn('text-xs', totalTooLowForRandom ? 'text-destructive' : 'text-muted-foreground')}>{totalHelperText}</p>
                    {preview && <p className="text-xs font-medium">{preview}</p>}
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="hasExpiry">Set an expiry</Label>
                        <Switch id="hasExpiry" checked={hasExpiry} onCheckedChange={setHasExpiry} />
                    </div>
                    {hasExpiry && <DateTimePicker value={expiresAt} onChange={setExpiresAt} />}
                </div>
            </CardContent>
        </Card>
    )
}
