// Fee Rebate — organized as *campaigns* so Junoswap can co-run programs with partners.
// One campaign = one partner + one collection + its own reward token + its own funded pool.
// Programs are assigned per-campaign by admin; users cannot choose.
export type RebateProgram = 'burn' | 'stake'

export interface RebatePartner {
    name: string
    logoUrl?: string
    /** true for Junoswap's own campaigns */
    official: boolean
}

export interface RebateRewardToken {
    symbol: string
    address: `0x${string}`
}

export interface RebateCampaign {
    id: string
    partner: RebatePartner
    collection: `0x${string}`
    collectionName: string
    program: RebateProgram
    /** Rebates are paid in this token — funded by the campaign owner, pools never mix */
    rewardToken: RebateRewardToken
    /** Rebate rate in basis points of trading fees paid on junoswap */
    rateBps: number
    /** Burn program only — lifetime cap per burned NFT, in reward-token units */
    lifetimeCap?: number
    /** Remaining funded pool (reward-token units) — payouts stop when exhausted */
    poolRemaining: number
    epochLengthDays: number
    startsAt: string
    endsAt?: string
}

export type NftRebateState = 'idle' | 'staked' | 'burned'

export interface RebateNft {
    collection: `0x${string}`
    tokenId: string
    name: string
    imageUrl?: string
    state: NftRebateState
    /** Burn program only — reward-token amount already accrued against the lifetime cap */
    capUsed?: number
}

export type EpochRewardStatus = 'accruing' | 'claimable' | 'claimed'

export interface EpochReward {
    campaignId: string
    epoch: number
    startsAt: string
    endsAt: string
    /** Fees the user paid trading on junoswap during the epoch (KUB) */
    feesPaidKub: number
    /** Rebate owed for the epoch, in the campaign's reward token */
    rebateAmount: number
    rewardTokenSymbol: string
    status: EpochRewardStatus
}
