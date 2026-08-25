'use client'

import { useEffect, useState } from 'react'
import { Send, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTelegramStartLink, useTelegramUnlink } from '@/hooks/useConnectSettings'
import { toastError } from '@/lib/toast'

const POLL_INTERVAL_MS = 3000

export function TelegramLinkCard() {
    const [waiting, setWaiting] = useState(false)
    const { data: me } = useCurrentUser({ refetchInterval: waiting ? POLL_INTERVAL_MS : false })
    const startLink = useTelegramStartLink()
    const unlink = useTelegramUnlink()

    // Stop polling once the webhook has paired chat_id (or the wallet linked from another tab).
    useEffect(() => {
        if (me?.telegram_chat_id) setWaiting(false)
    }, [me?.telegram_chat_id])

    const connect = async () => {
        try {
            const { deepLink, expiresInSeconds } = await startLink.mutateAsync()
            window.open(deepLink, '_blank', 'noopener,noreferrer')
            setWaiting(true)
            setTimeout(() => setWaiting(false), expiresInSeconds * 1000)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Could not start Telegram link')
        }
    }

    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                    <Send className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium">Telegram</p>
                        <p className="text-xs text-muted-foreground">
                            {me?.telegram_chat_id
                                ? `Connected${me.telegram_username ? ` as @${me.telegram_username}` : ''} — order alerts go to your Telegram`
                                : waiting
                                  ? 'Tap Start in the bot to finish linking…'
                                  : 'Tap Start in the bot to receive instant order alerts'}
                        </p>
                    </div>
                </div>
                {me?.telegram_chat_id ? (
                    <Button
                        variant="outline"
                        size="sm"
                        isLoading={unlink.isPending}
                        loadingText="Unlinking…"
                        onClick={() => unlink.mutate()}
                    >
                        <Check className="mr-1.5 h-4 w-4" /> Linked — unlink
                    </Button>
                ) : (
                    <Button size="sm" isLoading={waiting || startLink.isPending} loadingText="Waiting for Start…" onClick={connect}>
                        Open Telegram
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
