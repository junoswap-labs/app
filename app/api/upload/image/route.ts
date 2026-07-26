import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getSessionWallet } from '@/lib/auth/session'
import { resolveIpfs } from '@/lib/ipfs'

// Vercel serverless functions cap request bodies around 4.5MB — keep well under that so the
// error is "file too large" (clear) rather than a generic platform 413 (confusing).
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const WEBP_QUALITY = 82

/**
 * Accepts an image upload, converts it to WebP server-side (smaller, consistent format
 * regardless of what the user uploaded), pins it to IPFS via Pinata, and returns a
 * ready-to-display URL. Used by both the RWA listing form and (once built) the Redeem item
 * creation form — one upload primitive, not duplicated per form.
 */
export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const pinataJwt = process.env.PINATA_JWT
    if (!pinataJwt) return NextResponse.json({ error: 'image upload is not configured yet' }, { status: 503 })

    const formData = await request.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'only image files are accepted' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'image is too large (max 4MB)' }, { status: 413 })
    }

    let webp: Buffer
    try {
        const input = Buffer.from(await file.arrayBuffer())
        webp = await sharp(input).rotate().webp({ quality: WEBP_QUALITY }).toBuffer()
    } catch {
        return NextResponse.json({ error: 'could not process this image' }, { status: 400 })
    }

    const pinataForm = new FormData()
    pinataForm.append('file', new Blob([new Uint8Array(webp)], { type: 'image/webp' }), 'image.webp')

    const pinRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${pinataJwt}` },
        body: pinataForm,
    })
    if (!pinRes.ok) {
        return NextResponse.json({ error: 'upload to IPFS failed' }, { status: 502 })
    }
    const { IpfsHash: cid } = (await pinRes.json()) as { IpfsHash: string }

    return NextResponse.json({ cid, url: resolveIpfs(`ipfs://${cid}`) })
}
