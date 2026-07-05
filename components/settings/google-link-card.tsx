'use client'

import { useState } from 'react'
import { Mail, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMockSettings } from '@/store/mock-settings'
import { toastSuccess } from '@/lib/toast'

export function GoogleLinkCard() {
    const { googleEmail, setGoogleEmail } = useMockSettings()
    const [busy, setBusy] = useState(false)

    // MOCK: real flow is supabase.auth.signInWithOAuth({ provider: 'google' }) →
    // callback → POST /api/auth/link-google (requires a verified wallet session first)
    const connect = async () => {
        setBusy(true)
        await new Promise((r) => setTimeout(r, 800))
        setGoogleEmail('you@example.com')
        setBusy(false)
        toastSuccess('Google account linked (mock)')
    }

    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium">Google</p>
                        <p className="text-xs text-muted-foreground">
                            {googleEmail ?? 'Link your Google account for email notifications'}
                        </p>
                    </div>
                </div>
                {googleEmail ? (
                    <Button variant="outline" size="sm" onClick={() => setGoogleEmail(null)}>
                        <Check className="mr-1.5 h-4 w-4" /> Linked — unlink
                    </Button>
                ) : (
                    <Button size="sm" isLoading={busy} loadingText="Connecting…" onClick={connect}>
                        Connect Google
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
