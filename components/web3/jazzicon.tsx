'use client'

import { useRef, useEffect } from 'react'
import jazzicon from '@metamask/jazzicon'

interface JazziconProps {
    address: string
    size: number
    className?: string
}

export function Jazzicon({ address, size, className }: JazziconProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current || !address) return

        const seed = parseInt(address.slice(2, 10), 16)
        const icon = jazzicon(size, seed)

        if (ref.current.firstChild) {
            ref.current.removeChild(ref.current.firstChild)
        }
        ref.current.appendChild(icon)
    }, [address, size])

    return <div ref={ref} className={className} />
}
