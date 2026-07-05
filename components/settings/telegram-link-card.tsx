'use client'

import { useState } from 'react'
import { Send, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMockSettings } from '@/store/mock-settings'
import { toastSuccess } from '@/lib/toast'

export function TelegramLinkCard() {
    const { telegramLinked, setTelegramLinked } = useMockSettings()
    const [waiting, setWaiting] = useState(false)

    // MOCK: real flow is POST /api/telegram/start-link → open t.me deep-link →
    // user taps Start in Telegram → webhook pairs chat_id → this card polls
    // (or subscribes via Supabase Realtime) until the link shows up.
    const connect = async () => {
        setWaiting(true)
        await new Promise((r) => setTimeout(r, 1200))
        setTelegramLinked(true)
        setWaiting(false)
        toastSuccess('Telegram linked (mock)')
    }

    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                    <Send className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium">Telegram</p>
                        <p className="text-xs text-muted-foreground">
                            {telegramLinked
                                ? 'Connected — order alerts go to your Telegram'
                                : 'Tap Start in the bot to receive instant order alerts'}
                        </p>
                    </div>
                </div>
                {telegramLinked ? (
                    <Button variant="outline" size="sm" onClick={() => setTelegramLinked(false)}>
                        <Check className="mr-1.5 h-4 w-4" /> Linked — unlink
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        isLoading={waiting}
                        loadingText="Waiting for Start…"
                        onClick={connect}
                    >
                        Open Telegram
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
