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

// Only images this app produced are accepted in user-submitted content: /api/upload/image either
// writes to /uploads/<name> (local dev) or pins to IPFS and returns a gateway URL. Accepting an
// arbitrary URL would let a campaign or listing embed remote content we can't moderate, take down,
// or stop from tracking whoever views it — and the URL could start serving something else the day
// after a moderator approved it.
export function isAppHostedImageUrl(url: string): boolean {
    if (url.startsWith('/uploads/')) return true
    if (url.startsWith('ipfs://')) return true
    try {
        const { protocol, pathname, hostname } = new URL(url)
        return protocol === 'https:' && pathname.startsWith('/ipfs/') && !hostname.includes('..')
    } catch {
        return false
    }
}
