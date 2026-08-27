
-- One claim per person, not just per wallet: ip_dedupe_enabled defaulted to false, so a claimant
-- could reconnect a fresh wallet and claim the same campaign again. The claim route
-- (app/api/airdrop/claim/route.ts) already enforces IP dedupe when the flag is on — just flip the
-- default so new campaigns get it automatically, and backfill existing active campaigns to match.

alter table airdrop_campaigns alter column ip_dedupe_enabled set default true;

update airdrop_campaigns set ip_dedupe_enabled = true where status = 'active';
