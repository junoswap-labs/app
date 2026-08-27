'use client'

import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { PaymentToken } from '@/lib/tokens'

export interface SelectedToken {
    address: string
    decimals: number
    symbol?: string
}

interface TokenAmountInputProps {
    id?: string
    amount: string
    onAmountChange: (value: string) => void
    tokens: PaymentToken[]
    token: SelectedToken | null
    onTokenChange: (token: SelectedToken | null) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

/** Amount input fused with a token-select dropdown, backed by the per-chain PAYMENT_TOKENS
 *  allow-list in lib/tokens.ts — the list is keyed by the connected wallet's chain, so switching
 *  networks (e.g. mainnet -> testnet) changes which presets show up here. */
export function TokenAmountInput({
    id,
    amount,
    onAmountChange,
    tokens,
    token,
    onTokenChange,
    placeholder = '0.00',
    disabled,
    className,
}: TokenAmountInputProps) {
    const selectPreset = (t: PaymentToken) => onTokenChange({ address: t.address, decimals: t.decimals, symbol: t.symbol })

    return (
        <div
            className={cn(
                'flex h-9 w-full items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring',
                className
            )}
        >
            <input
                id={id}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={placeholder}
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                disabled={disabled}
                className="min-w-0 flex-1 bg-transparent px-3 py-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
            {tokens.length === 0 ? (
                <span className="flex items-center border-l px-3 text-xs text-muted-foreground">No tokens</span>
            ) : (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={disabled}
                            className="h-full shrink-0 gap-1 rounded-none border-l px-3 font-medium"
                        >
                            {token?.symbol ?? 'Select'}
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {tokens.map((t) => (
                            <DropdownMenuItem key={t.symbol} onSelect={() => selectPreset(t)}>
                                {t.symbol}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
