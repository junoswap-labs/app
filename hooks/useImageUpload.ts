'use client'

import { useMutation } from '@tanstack/react-query'

interface UploadResult {
    cid: string
    url: string
}

/** POST /api/upload/image — converts to WebP + pins to IPFS server-side. */
export function useImageUpload() {
    return useMutation({
        mutationFn: async (file: File): Promise<UploadResult> => {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch('/api/upload/image', { method: 'POST', body: formData })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `upload failed: ${res.status}`)
            }
            return res.json()
        },
    })
}
