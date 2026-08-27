import { keccak256 } from 'viem'

/**
 * Deterministic public identifier for a campaign, used in shared links/QR codes instead of the
 * raw on-chain campaignId — pure indirection, not a secrecy boundary: campaignId is already
 * unguessable (32 random bytes minted client-side, see hooks/useAirdropActions.ts) and every
 * campaign row is publicly readable regardless of visibility, so hiding the raw id from a shared
 * URL is cosmetic. Resolved back to campaignId via an indexed lookup on the share_hash column
 * (see supabase/migrations/0011_airdrop_visibility.sql), written by the sync poller alongside the
 * rest of CampaignCreated's fields since it's fully derived, not a creator choice.
 */
export function campaignShareHash(campaignId: `0x${string}`): string {
    return keccak256(campaignId).slice(2, 18) // 16 hex chars — plenty for a URL that isn't a security boundary
}
