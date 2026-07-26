-- Poller bookkeeping: the last block fully processed per watched contract, so a re-run resumes
-- instead of rescanning from scratch. Internal only — no public read policy, service role only.

create table sync_state (
  contract    text primary key,   -- e.g. 'nft_marketplace' | 'rwa_escrow'
  last_block  bigint not null,
  updated_at  timestamptz not null default now()
);

alter table sync_state enable row level security;
