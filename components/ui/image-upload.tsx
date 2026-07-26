'use client'

import { useRef } from 'react'
import { ImageOff, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useImageUpload } from '@/hooks/useImageUpload'
import { toastError } from '@/lib/toast'

interface ImageUploadFieldProps {
    value: string | null
    onChange: (url: string | null) => void
    label?: string
}

/** Shared upload primitive: pick an image → converted to WebP + pinned to IPFS server-side
 *  (app/api/upload/image) → onChange gets the resulting URL. Used by the RWA listing form and
 *  (once built) the Redeem item creation form. */
export function ImageUploadField({ value, onChange, label = 'Image' }: ImageUploadFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const upload = useImageUpload()

    const handleFile = (file: File | undefined) => {
        if (!file) return
        upload.mutate(file, {
            onSuccess: (result) => onChange(result.url),
            onError: (err) => toastError(err instanceof Error ? err.message : 'Upload failed'),
        })
    }

    return (
        <div className="space-y-1.5">
            <span className="text-sm font-medium leading-none">{label}</span>
            <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {upload.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={value} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <ImageOff className="h-5 w-5 text-muted-foreground" />
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={upload.isPending}
                        onClick={() => inputRef.current?.click()}
                    >
                        {value ? 'Replace' : 'Upload'}
                    </Button>
                    {value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={upload.isPending}
                            onClick={() => onChange(null)}
                        >
                            <X className="mr-1 h-3.5 w-3.5" /> Remove
                        </Button>
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                />
            </div>
        </div>
    )
}
