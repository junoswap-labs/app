import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: 'Junoswap App',
    description: 'Trade NFTs and real-world assets with ERC20 tokens on Bitkub Chain.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.variable}>
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
