import type { RedeemItem } from '@/types/redeem'

// Mock catalog + balances for the frontend-only phase.
export const MOCK_POINT_BALANCE = 12450

export const MOCK_TOKEN_BALANCES: Record<string, number> = {
    JUNO: 830,
    KUB: 42.5,
    CMH: 15600,
}

export const MOCK_REDEEM_ITEMS: RedeemItem[] = [
    {
        id: 'official-nft-genesis',
        tier: 'official',
        kind: 'nft',
        name: 'Juno Genesis Pass',
        description: 'Limited genesis NFT — unlocks future official drops.',
        pricePoints: 5000,
        priceToken: 200,
        tokenSymbol: 'JUNO',
        stock: 12,
    },
    {
        id: 'official-merch-tee',
        tier: 'official',
        kind: 'merch',
        name: 'Junoswap T-Shirt',
        description: 'Official tee, ships within Thailand.',
        pricePoints: 2500,
        priceToken: 80,
        tokenSymbol: 'JUNO',
        stock: 40,
    },
    {
        id: 'official-merch-cap',
        tier: 'official',
        kind: 'merch',
        name: 'Junoswap Cap',
        description: 'Embroidered logo cap.',
        pricePoints: 1800,
        priceToken: 60,
        tokenSymbol: 'JUNO',
        stock: 0,
    },
    {
        id: 'registered-nft-hexacat',
        tier: 'registered',
        kind: 'nft',
        name: 'Hexa Cat Meaw — Redeem Edition',
        description: 'Special edition from a registered community token.',
        pricePoints: 3000,
        priceToken: 9000,
        tokenSymbol: 'CMH',
        stock: 25,
    },
    {
        id: 'registered-merch-sticker',
        tier: 'registered',
        kind: 'merch',
        name: 'Hexa Cat Sticker Pack',
        description: 'Community sticker set (registered token).',
        pricePoints: 500,
        priceToken: 1200,
        tokenSymbol: 'CMH',
        stock: null,
    },
]
