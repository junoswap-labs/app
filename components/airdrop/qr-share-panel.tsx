'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function QrSharePanel({ url }: { url: string }) {
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg border bg-white p-3">
                <QRCodeSVG value={url} size={160} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy link'}
            </Button>
        </div>
    )
}
