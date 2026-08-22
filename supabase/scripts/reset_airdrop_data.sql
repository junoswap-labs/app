-- Wipes every airdrop row and the poller's cursor, so the next sync re-indexes from scratch against
-- whatever AirdropEscrow deployment NEXT_PUBLIC_AIRDROP_ESCROW_ADDRESS now points at.
--
-- Run this after redeploying AirdropEscrow: campaigns in these tables belong to the *old* contract
-- address, and nothing in the schema records which deployment a row came from, so leaving them
-- would mix two contracts' campaigns in one feed — claims against them would fail on-chain because
-- the new contract has never heard of those campaignIds.
--
-- Not a migration: it deletes data, so it must be a deliberate, manual run (Supabase SQL editor or
-- `psql`), never something that replays automatically on every environment.
--
-- Before running: set AIRDROP_ESCROW_DEPLOY_BLOCK to the new deployment's block, otherwise the
-- poller restarts from the old (lower) block and grinds through everything in between.

begin;

-- Children first — airdrop_claims/airdrop_claim_attempts reference airdrop_campaigns.
delete from airdrop_claim_attempts;
delete from airdrop_claims;
delete from airdrop_campaigns;

-- Drop the cursor so services/sync/poller.ts starts again from target.deployBlock.
delete from sync_state where contract = 'airdrop_escrow';

-- Audit trail of the old deployment: kept on purpose. It records what happened, and the rows are
-- harmless once the campaigns they point at are gone. Uncomment to clear it too.
-- delete from audit_logs where subject_type = 'airdrop_campaign';

commit;
