import type { RebateCampaign, RebateNft, EpochReward } from '@/types/rebate'

// Mock data for the frontend-only phase — replaced by contract/Supabase reads later.
export const MOCK_REBATE_CAMPAIGNS: RebateCampaign[] = [
    {
        id: 'cmp-junoswap-hexacat',
        partner: { name: 'Junoswap', official: true },
        collection: '0x1111111111111111111111111111111111111111',
        collectionName: 'CM Hexa Cat Meaw',
        program: 'burn',
        rewardToken: { symbol: 'KUB', address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        rateBps: 5000,
        lifetimeCap: 500,
        poolRemaining: 42_000,
        epochLengthDays: 7,
        startsAt: '2026-04-01T00:00:00Z',
    },
    {
        id: 'cmp-mooncat-guardians',
        partner: { name: 'MoonCat Studio', official: false },
        collection: '0x2222222222222222222222222222222222222222',
        collectionName: 'Juno Guardians',
        program: 'stake',
        rewardToken: { symbol: 'MCT', address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        rateBps: 2000,
        poolRemaining: 180_000,
        epochLengthDays: 14,
        startsAt: '2026-06-01T00:00:00Z',
        endsAt: '2026-12-01T00:00:00Z',
    },
]

export const MOCK_REBATE_NFTS: RebateNft[] = [
    {
        collection: '0x1111111111111111111111111111111111111111',
        tokenId: '412',
        name: 'Hexa Cat Meaw #412',
        imageUrl: 'https://bitkubipfs.io/ipfs/Qmcc3eHFCVzPkrwuCxb5B4YRH9Dq7YMtd7p19rSL3dHAjN',
        state: 'idle',
    },
    {
        collection: '0x1111111111111111111111111111111111111111',
        tokenId: '957',
        name: 'Hexa Cat Meaw #957',
        imageUrl: 'https://bitkubipfs.io/ipfs/Qmbnonh1qMx66hDnfd6iZ23kaySH8Gjw7XBJakYqq5jLtv',
        state: 'burned',
        capUsed: 132.5,
    },
    {
        collection: '0x2222222222222222222222222222222222222222',
        tokenId: '18',
        name: 'Juno Guardian #18',
        imageUrl: 'https://bitkubipfs.io/ipfs/QmZ1QuQwm3tzthtHcJSzEpuAaKcap5kBf9q2vWMd8gUiwr',
        state: 'staked',
    },
    {
        collection: '0x2222222222222222222222222222222222222222',
        tokenId: '77',
        name: 'Juno Guardian #77',
        imageUrl: 'https://bitkubipfs.io/ipfs/QmWri2uiydN5qPs4a3VruZE5D72YWPMWeY4R6enKxbJEZ6',
        state: 'idle',
    },
]

export const MOCK_EPOCH_REWARDS: EpochReward[] = [
    {
        campaignId: 'cmp-junoswap-hexacat',
        epoch: 14,
        startsAt: '2026-06-29T00:00:00Z',
        endsAt: '2026-07-06T00:00:00Z',
        feesPaidKub: 42.8,
        rebateAmount: 18.2,
        rewardTokenSymbol: 'KUB',
        status: 'accruing',
    },
    {
        campaignId: 'cmp-junoswap-hexacat',
        epoch: 13,
        startsAt: '2026-06-22T00:00:00Z',
        endsAt: '2026-06-29T00:00:00Z',
        feesPaidKub: 96.4,
        rebateAmount: 41.1,
        rewardTokenSymbol: 'KUB',
        status: 'claimable',
    },
    {
        campaignId: 'cmp-mooncat-guardians',
        epoch: 3,
        startsAt: '2026-06-15T00:00:00Z',
        endsAt: '2026-06-29T00:00:00Z',
        feesPaidKub: 55.0,
        rebateAmount: 320,
        rewardTokenSymbol: 'MCT',
        status: 'claimable',
    },
    {
        campaignId: 'cmp-mooncat-guardians',
        epoch: 2,
        startsAt: '2026-06-01T00:00:00Z',
        endsAt: '2026-06-15T00:00:00Z',
        feesPaidKub: 23.4,
        rebateAmount: 140,
        rewardTokenSymbol: 'MCT',
        status: 'claimed',
    },
]
