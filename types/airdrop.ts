// Airdrop — shareable-link/QR token giveaways via contracts/src/AirdropEscrow.sol. Snake_case,
// matching the DB row shape directly (supabase/migrations/0009_airdrop_schema.sql / types/supabase.ts),
// same convention as types/redeem.ts since this schema is real from day one.
export type AirdropAmountMode = 'fixed' | 'random'
export type AirdropGasMode = 'self' | 'relayer'
export type AirdropVisibility = 'public' | 'unlisted'

// Mirrors AirdropEscrow.CampaignStatus exactly — written only by the sync poller.
export type AirdropCampaignStatus = 'active' | 'closed' | 'reclaimed'

export interface AirdropCampaign {
    id: string // AirdropEscrow campaignId (bytes32 hex)
    creator_wallet: string
    token: string
    token_symbol: string | null
    token_decimals: number | null
    amount_mode: AirdropAmountMode
    fixed_amount: string | null // base units, amount_mode == 'fixed'
    min_amount: string | null // base units, amount_mode == 'random'
    max_amount: string | null // base units, amount_mode == 'random'
    total_amount: string // base units
    remaining_amount: string // base units, mirrors the contract's remainingAmount
    max_claimants: number | null // null/0 = unlimited
    claimed_count: number
    expires_at: string | null // null = no expiry
    gas_mode: AirdropGasMode
    gas_deposit: string // base units (wei), gas_mode == 'relayer'
    gas_spent: string // wei reimbursed to the relayer so far, <= gas_deposit
    share_hash: string | null // deterministic keccak256(id) prefix — see lib/onchain/airdrop-share.ts
    visibility: AirdropVisibility
    // Off-chain-only, soft/UX-layer restrictions — never enforced on-chain, see AirdropEscrow.sol's
    // header comment on claimFor()'s trust boundary.
    location_restricted: boolean
    location_lat: number | null
    location_lng: number | null
    location_radius_m: number | null
    ip_dedupe_enabled: boolean
    title: string | null
    description: string | null
    cover_image_url: string | null
    status: AirdropCampaignStatus
    tx_hash: string | null
    created_at: string
}

export interface AirdropClaim {
    id: string
    campaign_id: string
    recipient_wallet: string
    amount: string // base units
    tx_hash: string
    log_index: number
    submitter: AirdropGasMode
    claimed_at: string
}

export type AirdropClaimAttemptOutcome =
    | 'ok'
    | 'rejected_location'
    | 'rejected_ip_dedupe'
    | 'rejected_already_claimed'
    | 'rejected_campaign_inactive'

export interface AirdropClaimAttempt {
    id: string
    campaign_id: string
    session_wallet: string
    recipient_wallet: string | null
    client_ip: string | null
    outcome: AirdropClaimAttemptOutcome
    attempted_at: string
}
