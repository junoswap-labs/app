import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getSessionWallet } from '@/lib/auth/session'
import { resolveIpfs } from '@/lib/ipfs'

// Vercel serverless functions cap request bodies around 4.5MB — keep well under that so the
// error is "file too large" (clear) rather than a generic platform 413 (confusing).
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const TARGET_BYTES = 10 * 1024

// True mathematically-lossless WebP essentially never fits real photos into 10KB — this instead
// steps down quality (and, if that alone isn't enough, dimensions) from a near-lossless starting
// point until the output fits, stopping at the first step that hits the target so most images
// keep the least amount of quality loss needed. If nothing in the ladder reaches 10KB (a very
// busy/large source image), the smallest result actually achieved is used instead of forcing
// further degradation — the "smallest recommended size" fallback.
const COMPRESSION_STEPS: { width?: number; quality: number }[] = [
    { quality: 90 },
    { quality: 75 },
    { quality: 60 },
    { width: 1024, quality: 60 },
    { width: 1024, quality: 45 },
    { width: 640, quality: 45 },
    { width: 640, quality: 30 },
    { width: 480, quality: 30 },
    { width: 320, quality: 25 },
]

async function compressToTarget(input: Buffer): Promise<{ buffer: Buffer; metTarget: boolean }> {
    let smallest: Buffer | null = null
    for (const step of COMPRESSION_STEPS) {
        let pipeline = sharp(input).rotate()
        if (step.width) pipeline = pipeline.resize({ width: step.width, withoutEnlargement: true })
        const buffer = await pipeline.webp({ quality: step.quality }).toBuffer()
        if (!smallest || buffer.byteLength < smallest.byteLength) smallest = buffer
        if (buffer.byteLength <= TARGET_BYTES) return { buffer, metTarget: true }
    }
    return { buffer: smallest as Buffer, metTarget: false }
}

/**
 * Accepts an image upload, converts it to WebP server-side and auto-compresses toward a 10KB
 * target (see compressToTarget above), pins it to IPFS via Pinata, and returns a ready-to-display
 * URL. Used by both the RWA listing form and the Redeem item creation form — one upload primitive,
 * not duplicated per form. In local dev without a PINATA_JWT configured, falls back to writing
 * the file under public/uploads/ instead (see useLocalFallback below).
 */
export async function POST(request: NextRequest) {
    const wallet = getSessionWallet(request)
    if (!wallet) return NextResponse.json({ error: 'not signed in' }, { status: 401 })

    const pinataJwt = process.env.PINATA_JWT
    const useLocalFallback = !pinataJwt && process.env.NODE_ENV === 'development'
    if (!pinataJwt && !useLocalFallback) {
        return NextResponse.json({ error: 'image upload is not configured yet' }, { status: 503 })
    }

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
    let metTarget: boolean
    try {
        const input = Buffer.from(await file.arrayBuffer())
        ;({ buffer: webp, metTarget } = await compressToTarget(input))
    } catch {
        return NextResponse.json({ error: 'could not process this image' }, { status: 400 })
    }

    // Dev-only fallback so listing forms are usable without a PINATA_JWT configured locally —
    // never reachable when PINATA_JWT is set, and double-gated on NODE_ENV so a prod deploy that
    // forgot the env var 503s instead of silently writing to (ephemeral, read-only) local disk.
    if (useLocalFallback) {
        const filename = `${randomUUID()}.webp`
        const uploadsDir = join(process.cwd(), 'public', 'uploads')
        await mkdir(uploadsDir, { recursive: true })
        await writeFile(join(uploadsDir, filename), webp)
        return NextResponse.json({ cid: 'local', url: `/uploads/${filename}`, bytes: webp.byteLength, metTarget })
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

    return NextResponse.json({ cid, url: resolveIpfs(`ipfs://${cid}`), bytes: webp.byteLength, metTarget })
}
