-- User-submitted reports on public content (airdrop campaigns today, Redeem items later). The
-- moderation actions themselves stay where they already are — see app/api/airdrop/campaigns/[id]/
-- metadata's admin path — this table only carries the queue of "somebody says look at this".
create table content_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  reporter_wallet text not null references users(wallet_address),
  subject_type  text not null,               -- 'airdrop_campaign' | 'redeem_item'
  subject_id    text not null,               -- campaign id / item id
  reason        text not null,               -- 'scam' | 'adult' | 'gambling' | 'impersonation' | 'other'
  detail        text,

  status        text not null default 'open', -- 'open' | 'actioned' | 'dismissed'
  resolved_by   text references users(wallet_address),
  resolved_at   timestamptz
);

create index content_reports_status_idx on content_reports (status, created_at desc);
create index content_reports_subject_idx on content_reports (subject_type, subject_id);

-- One open report per wallet per subject: a single reporter spamming the queue adds noise without
-- adding signal, and the count of distinct reporters is what actually matters for triage.
create unique index content_reports_one_open_per_reporter_idx
  on content_reports (reporter_wallet, subject_type, subject_id)
  where status = 'open';

alter table content_reports enable row level security;
-- No anon/authenticated policies at all: reports are submitted and read through Route Handlers
-- using the service role, which also does the admin check. A public read would expose who reported
-- whom, and a public write would let anyone forge a reporter_wallet.
