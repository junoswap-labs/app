'use client'

import { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet } from 'lucide-react'
import { ConnectModal } from './connect-modal'
import { AccountDropdown } from './account-dropdown'
import { Jazzicon } from './jazzicon'
import { formatAddress } from '@/lib/utils'
import { toastSuccess } from '@/lib/toast'

function AccountInfo({ className = '' }: { className?: string }) {
    const { address } = useAccount()
    return (
        <AccountDropdown>
            <button
                className={`relative flex items-center gap-2 h-8 px-2 rounded-md text-xs font-mono text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors ${className}`}
                aria-label="Account menu"
            >
                <Jazzicon
                    address={address || ''}
                    size={24}
                    className="sm:hidden flex-shrink-0 overflow-hidden rounded-full [&>div]:rounded-full"
                />
                <span className="hidden sm:inline">
                    {address ? formatAddress(address, 4, 3) : '...'}
                </span>
            </button>
        </AccountDropdown>
    )
}

export function ConnectButton({ className = '' }: { className?: string }) {
    const { isConnected } = useAccount()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const previousIsConnected = useRef(false)
    useEffect(() => {
        if (isConnected && !previousIsConnected.current) {
            toastSuccess('Wallet connected')
        }
        previousIsConnected.current = isConnected
    }, [isConnected])
    if (isConnected) {
        return <AccountInfo className={className} />
    }
    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                className={`gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground ${className}`}
                onClick={() => setIsModalOpen(true)}
                aria-label="Connect wallet"
            >
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                Connect
            </Button>
            <ConnectModal open={isModalOpen} onOpenChange={setIsModalOpen} />
        </>
    )
}
