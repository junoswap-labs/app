'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAccount, useChainId, useSignMessage } from 'wagmi'
import { SiweMessage } from 'siwe'

/**
 * Establishes the `juno_session` cookie (see lib/auth/session.ts) that every service-role write
 * route — image upload, listing/order creation, etc. — requires via getSessionWallet. Wagmi's own
 * `isConnected`/`address` never creates this cookie on its own; it only exists after a real SIWE
 * nonce -> sign -> verify round trip, which is what this hook performs.
 */
export function useSiweSignIn() {
    const { address } = useAccount()
    const chainId = useChainId()
    const { signMessageAsync } = useSignMessage()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async () => {
            if (!address) throw new Error('Connect a wallet first')

            const nonceRes = await fetch('/api/auth/nonce')
            if (!nonceRes.ok) throw new Error('Could not start sign-in')
            const { nonce } = (await nonceRes.json()) as { nonce: string }

            const siwe = new SiweMessage({
                domain: window.location.host,
                address,
                statement: 'Sign in to Junoswap App.',
                uri: window.location.origin,
                version: '1',
                chainId,
                nonce,
            })
            const message = siwe.prepareMessage()
            const signature = await signMessageAsync({ message })

            const verifyRes = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, signature }),
            })
            if (!verifyRes.ok) {
                const body = await verifyRes.json().catch(() => null)
                throw new Error(body?.error ?? 'Sign-in failed')
            }
            return verifyRes.json() as Promise<{ wallet_address: string }>
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['me'] })
        },
    })
}
