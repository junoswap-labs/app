-- Adds two off-chain fields to airdrop_campaigns:
--   share_hash — deterministic keccak256(campaignId) prefix (see lib/onchain/airdrop-share.ts),
--                written by the sync poller from CampaignCreated since it's fully derived from
--                campaignId, not a creator choice. Used in place of the raw campaignId in shared
--                links/QR codes — indirection only, not a secrecy boundary (see that file's header
--                comment for why).
--   visibility — 'public' (shown on /app/airdrop's Browse page) or 'unlisted' (reachable only via
--                its direct link/QR) — a genuine creator choice, so this is written by the
--                metadata Route Handler like title/description, not the poller.

alter table airdrop_campaigns
  add column share_hash text,
  add column visibility text not null default 'public';

-- Backfill is a no-op in practice: this migration ships before any campaign has been created
-- against the current (post-gas-escrow) contract ABI, so there are no existing rows to fill in.
-- share_hash is still nullable at the column level since a pre-existing row (if any) has no
-- deterministic value to backfill without the sync poller re-running from that row's block.

create unique index airdrop_campaigns_share_hash_idx on airdrop_campaigns (share_hash);
