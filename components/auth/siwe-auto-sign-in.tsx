'use client'

import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useSiweSignIn } from '@/hooks/useSiweSignIn'
import { toastError } from '@/lib/toast'

/**
 * Mounted once near the app root (see app/providers.tsx). Silently prompts a SIWE signature right
 * after a wallet connects, whenever there's no existing session cookie for that address — without
 * this, connecting a wallet never actually signs the user in, and every service-role write route
 * (image upload, listing/order creation, etc.) 401s with "not signed in".
 */
export function SiweAutoSignIn() {
    const { address, isConnected } = useAccount()
    const { data: me, isLoading } = useCurrentUser()
    const signIn = useSiweSignIn()
    const attemptedFor = useRef<string | null>(null)

    useEffect(() => {
        if (!isConnected || !address || isLoading) return
        if (me?.wallet_address?.toLowerCase() === address.toLowerCase()) return
        if (attemptedFor.current === address || signIn.isPending) return

        attemptedFor.current = address
        signIn.mutate(undefined, {
            onError: (err) => toastError(err instanceof Error ? err : 'Sign-in was skipped — some actions may require it'),
        })
        // signIn is a fresh useMutation result object every render — only address/session state
        // should retrigger this effect, not identity churn on the mutation object itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, address, isLoading, me?.wallet_address])

    // Reset the guard when the wallet disconnects so reconnecting the same address re-attempts.
    useEffect(() => {
        if (!isConnected) attemptedFor.current = null
    }, [isConnected])

    return null
}
