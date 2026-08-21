
-- Airdrop schema — shareable-link/QR token giveaways via contracts/src/AirdropEscrow.sol.
-- `airdrop_campaigns.id` IS that contract's bytes32 campaignId, minted off-chain by the backend
-- before createCampaign() is called (same "backend mints the on-chain key" convention as
-- rwa_listings.id / redemption_orders.escrow_listing_id). The sync poller (services/sync/handlers.ts)
-- is the sole writer of every on-chain-authoritative column below; the metadata Route Handler
-- (app/api/airdrop/campaigns/[id]/metadata) only ever writes the off-chain-only columns (title,
-- description, cover_image_url, location_*, ip_dedupe_enabled) — see CLAUDE.md's Clean Workflow.

create table airdrop_campaigns (
  id                  text primary key,             -- AirdropEscrow campaignId (bytes32 hex)
  creator_wallet      text not null references users(wallet_address),
  token               text not null,                 -- lowercase ERC20 address
  token_symbol        text,
  -- token_symbol/token_decimals are off-chain-only, sourced from the creator's own on-chain ERC20
  -- read at creation time (see hooks/useAirdropActions.ts) — neither the poller nor the contract
  -- itself has any use for a token's decimals, so this stays out of the sync-authoritative columns.
  -- A creator submitting a wrong value only breaks their own campaign's display; real transfer
  -- amounts are governed by on-chain base units regardless.
  token_decimals      integer,
  amount_mode         text not null,                 -- 'fixed' | 'random' — AirdropEscrow.AmountMode
  fixed_amount        numeric,                        -- base units, amount_mode == 'fixed'
  min_amount          numeric,                        -- base units, amount_mode == 'random'
  max_amount          numeric,                        -- base units, amount_mode == 'random'
  total_amount        numeric not null,                -- base units, deposited at creation
  remaining_amount    numeric not null,                -- base units, mirrors the contract's remainingAmount
  max_claimants       integer,                         -- null/0 = unlimited, matches AirdropEscrow's uint32 maxClaimants
  claimed_count       integer not null default 0,
  expires_at          timestamptz,                     -- null = no expiry, matches AirdropEscrow's expiresAt == 0
  gas_mode            text not null default 'self',    -- 'self' | 'relayer' — who submits claim txs
  location_restricted boolean not null default false,  -- off-chain-only: GPS geofence (soft, UX-layer)
  location_lat        double precision,
  location_lng        double precision,
  location_radius_m   integer,
  ip_dedupe_enabled   boolean not null default false,   -- off-chain-only: reject a 2nd claim attempt from the same IP
  title               text,
  description         text,
  cover_image_url     text,
  -- Mirrors AirdropEscrow.CampaignStatus exactly: 'active' | 'closed' | 'reclaimed'.
  status              text not null default 'active',
  tx_hash             text,                            -- createCampaign() tx, for the explorer link
  created_at          timestamptz not null default now()
);

create index airdrop_campaigns_creator_idx on airdrop_campaigns (creator_wallet, status);
create index airdrop_campaigns_status_idx on airdrop_campaigns (status, created_at desc);

-- One row per successful on-chain claim, written only by the sync poller off AirdropClaimed.
create table airdrop_claims (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      text not null references airdrop_campaigns(id),
  recipient_wallet text not null,
  amount           numeric not null,   -- base units
  tx_hash          text not null,
  log_index        integer not null,
  submitter        text not null,      -- 'self' | 'relayer' — which claim entry point was used
  claimed_at       timestamptz not null default now()
);

create index airdrop_claims_campaign_idx on airdrop_claims (campaign_id, claimed_at desc);
create index airdrop_claims_recipient_idx on airdrop_claims (recipient_wallet);

-- Same dedup idiom as audit_logs_onchain_dedup_idx: a reprocessed/overlapping getLogs range can
-- decode the same AirdropClaimed log twice, this index makes the second insert a no-op 23505.
create unique index airdrop_claims_onchain_dedup_idx
  on airdrop_claims (tx_hash, log_index);

-- Pre-chain gating log for GPS/IP checks (app/api/airdrop/claim) — NOT on-chain status, so this is
-- written directly by the Route Handler, not the sync poller. Carries client IPs, so it stays off
-- the public-read surface (see RLS below).
create table airdrop_claim_attempts (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      text not null references airdrop_campaigns(id),
  session_wallet   text not null,      -- the SIWE-authenticated wallet making the request
  recipient_wallet text,               -- may differ from session_wallet — see the "paste an address" claim path
  client_ip        text,
  outcome          text not null,      -- e.g. 'ok' | 'rejected_location' | 'rejected_ip_dedupe' | 'rejected_already_claimed'
  attempted_at     timestamptz not null default now()
);

create index airdrop_claim_attempts_campaign_ip_idx on airdrop_claim_attempts (campaign_id, client_ip);
create index airdrop_claim_attempts_campaign_wallet_idx on airdrop_claim_attempts (campaign_id, session_wallet);

alter table airdrop_campaigns enable row level security;
alter table airdrop_claims enable row level security;
alter table airdrop_claim_attempts enable row level security;

-- Campaigns and claims are safe to expose publicly (a live claim feed is part of the "fun" of a
-- giveaway link) — nothing here is more sensitive than what's already readable straight off-chain.
create policy "airdrop_campaigns public read" on airdrop_campaigns for select using (true);
create policy "airdrop_claims public read" on airdrop_claims for select using (true);
-- airdrop_claim_attempts carries client IPs — no public read policy; only the service role (Route
-- Handlers) reads/writes it, same convention as redemption_orders' shipping PII.
