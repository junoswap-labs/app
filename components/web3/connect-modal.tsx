'use client'

import { useConnect } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Wallet, Loader2 } from 'lucide-react'
import { toastError } from '@/lib/toast'
import type { ConnectModalProps } from '@/types/web3'

const WALLET_NAMES: Record<string, string> = {
    injected: 'Browser Wallet',
    walletConnect: 'WalletConnect',
    coinbaseWallet: 'Coinbase Wallet',
}

export function ConnectModal({ open, onOpenChange }: ConnectModalProps) {
    const { connect, connectors, isPending } = useConnect()
    const handleConnect = async (connectorId: string) => {
        const connector = connectors.find((c) => c.id === connectorId)
        if (!connector) return
        try {
            await connect({ connector })
            onOpenChange(false)
        } catch (error: unknown) {
            const isUserRejection =
                typeof error === 'object' &&
                error !== null &&
                (('code' in error && error.code === 4001) ||
                    ('message' in error &&
                        typeof error.message === 'string' &&
                        error.message.includes('User rejected')))
            if (isUserRejection) {
                toastError('Connection rejected by user')
            } else {
                toastError('Failed to connect wallet')
            }
        }
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50"
                aria-describedby="wallet-connect-description"
            >
                <DialogHeader>
                    <DialogTitle className="text-lg">Connect Wallet</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    {connectors.map((connector) => (
                        <Button
                            key={connector.id}
                            variant="outline"
                            className="w-full justify-start h-12 px-3 hover:bg-muted/50 hover:border-border"
                            onClick={() => handleConnect(connector.id)}
                            disabled={isPending}
                            aria-label={`Connect with ${WALLET_NAMES[connector.id] || connector.name}`}
                        >
                            {isPending ? (
                                <Loader2 className="mr-3 h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Wallet className="mr-3 h-4 w-4" aria-hidden="true" />
                            )}
                            <div className="flex flex-col items-start">
                                <span className="font-medium">
                                    {WALLET_NAMES[connector.id] || connector.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {connector.type === 'injected'
                                        ? 'Browser wallet'
                                        : connector.type}
                                </span>
                            </div>
                        </Button>
                    ))}
                </div>
                <p className="text-center text-xs text-muted-foreground/70 pb-1">
                    By connecting, you agree to our Terms of Service
                </p>
            </DialogContent>
        </Dialog>
    )
}
