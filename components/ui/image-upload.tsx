'use client'

import { useRef } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImageUpload } from '@/hooks/useImageUpload'
import { toastError } from '@/lib/toast'

interface ImageUploadFieldProps {
    value: string | null
    onChange: (url: string | null) => void
    label?: string
}

/** Shared upload primitive: pick an image → converted to WebP + pinned to IPFS server-side
 *  (app/api/upload/image) → onChange gets the resulting URL. Used by the RWA and Redeem listing
 *  forms. The whole tile is the click target (icon-only — no "Upload"/"Replace"/"Remove" buttons);
 *  a small badge in the corner removes the photo once one is set. */
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
            <div className="group relative h-20 w-20 shrink-0">
                <button
                    type="button"
                    disabled={upload.isPending}
                    onClick={() => inputRef.current?.click()}
                    aria-label={value ? 'Replace photo' : 'Add photo'}
                    className={cn(
                        'flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-70',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        !value && 'border-dashed hover:border-primary hover:bg-accent'
                    )}
                >
                    {upload.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={value} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <Camera className="h-5 w-5 text-muted-foreground" />
                    )}
                </button>

                {value && !upload.isPending && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                        <Camera className="h-5 w-5 text-white" />
                    </div>
                )}

                {value && !upload.isPending && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        aria-label="Remove photo"
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}

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
