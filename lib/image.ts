// Shrink images (resize + webp) via the free wsrv.nl image proxy.
// Processing happens on wsrv's side (Cloudflare), not Vercel → doesn't consume
// Vercel Image Optimization quota, and fewer bytes reach the client (e.g. 11KB PNG → ~6KB webp)
const PROXY = 'https://wsrv.nl/'

interface ImageOpts {
    width?: number // target px (won't upscale past the original, via the &we flag)
}

export function optimizeImage(url: string | null, { width = 400 }: ImageOpts = {}): string | null {
    if (!url) return null
    // data: URIs embed the image inline — no need to proxy (and the proxy can't) — use as-is
    if (url.startsWith('data:')) return url
    const params = new URLSearchParams({ url, w: String(width), output: 'webp', we: '' })
    return `${PROXY}?${params.toString()}`
}
