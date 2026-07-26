-- Generalizes the KYC-application pattern already used once (the removed users.role column in
-- 0003) and once more (components/admin/redemption-queue.tsx's mock store) into a single table,
-- rather than one near-duplicate table per approval kind. `payload` absorbs kind-specific fields
-- (KYC personal data for authorize_rwa; a pitch/company shape for the two partner_* kinds).
--
-- Approving a row here is an AUDIT TRAIL ONLY — it does not itself grant anything. The actual
-- authority grant is PermissionRegistry.grantRole(wallet, ROLE) on-chain, signed by an admin
-- wallet from the frontend (see contracts/src/PermissionRegistry.sol, lib/onchain/roles.ts).
-- A row can reach status='approved' here and still not be authorized on-chain if the admin's
-- grantRole tx never happened or was later revoked — always check on-chain for the real answer.

create table applications (
  id            uuid primary key default gen_random_uuid(),
  wallet_address text not null references users(wallet_address),
  kind          text not null,          -- 'authorize_rwa' | 'partner_marketplace' | 'partner_redeem'
  status        text not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
  payload       jsonb not null default '{}',
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   text references users(wallet_address),
  reject_reason text
);

-- One pending application per (wallet, kind) at a time — resubmitting after rejection is fine,
-- resubmitting while already pending is not.
create unique index applications_one_pending_idx on applications (wallet_address, kind)
  where status = 'pending';

create index applications_kind_status_idx on applications (kind, status, submitted_at desc);
create index applications_wallet_idx on applications (wallet_address, kind);

alter table applications enable row level security;

-- No public read policy: applications carry personal data (KYC payload) and pitch details.
-- Reads/writes go through Route Handlers using the service role, gated by session + (for the
-- admin queue) a live on-chain isAdmin check — never the anon client directly.
