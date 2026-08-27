-- Adds the on-chain gas escrow added to AirdropEscrow.sol's relayer mode: a creator now prepays a
-- native-KUB gasDeposit at campaign creation (sized off-chain as estimatedGas * 1.3 *
-- maxClaimants), claimFor() reimburses the relayer out of it, and the creator reclaims any unspent
-- balance with a manual reclaimGas() call. gas_mode itself is unchanged in shape but now flows
-- from the CampaignCreated event (it's part of the event's payload now) instead of solely from the
-- metadata PATCH — see hooks/useAirdropActions.ts and services/sync/handlers.ts.

alter table airdrop_campaigns
  add column gas_deposit numeric not null default 0, -- native KUB wei, gas_mode == 'relayer'
  add column gas_spent   numeric not null default 0;  -- wei reimbursed to the relayer so far, <= gas_deposit

-- Idempotency ledger for GasReimbursed — gas_spent is a running counter (like remaining_amount/
-- claimed_count above it), so a reprocessed log must not double-count it. Same dedup idiom as
-- airdrop_claims_onchain_dedup_idx. See handleAirdropGasReimbursed in services/sync/handlers.ts.
create table airdrop_gas_reimbursements (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   text not null references airdrop_campaigns(id),
  tx_hash       text not null,
  log_index     integer not null,
  amount        numeric not null,
  reimbursed_at timestamptz not null default now()
);

create unique index airdrop_gas_reimbursements_dedup_idx on airdrop_gas_reimbursements (tx_hash, log_index);

alter table airdrop_gas_reimbursements enable row level security;

-- Same reasoning as airdrop_claims' public-read policy in 0009 — nothing here is more sensitive
-- than what's already readable straight off-chain.
create policy "airdrop_gas_reimbursements public read" on airdrop_gas_reimbursements for select using (true);
