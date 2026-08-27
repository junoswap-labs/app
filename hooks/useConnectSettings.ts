'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'

async function postJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `request failed: ${res.status}`)
    }
    return res.json()
}

/** Returns the t.me deep link to open — the actual pairing happens async via the bot webhook, so
 *  the caller should poll GET /api/me (useCurrentUser) until telegram_chat_id shows up. */
export function useTelegramStartLink() {
    return useMutation({
        mutationFn: () => postJson<{ deepLink: string; expiresInSeconds: number }>('/api/telegram/start-link'),
    })
}

export function useTelegramUnlink() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => postJson('/api/telegram/unlink'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
    })
}
