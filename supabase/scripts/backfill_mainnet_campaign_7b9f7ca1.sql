-- One-off backfill: the KUB mainnet (chain 96) airdrop campaign created in tx
-- 0xd8a06f0c0f5cc3aa94f4bdf83d39abb80716888cf049979c413601a9a92f1c2c (block 34735091,
-- AirdropEscrow 0x8dabacd4da790a5b22f51bd3433123b6578b68eb) never reached Supabase because the
-- sync poller had not yet run against mainnet. All on-chain-authoritative columns below are read
-- straight from getCampaign(campaignId) on that contract — same values the poller's
-- handleAirdropCampaignCreated would have written.
--
-- The off-chain metadata columns (title / description / cover_image_url / visibility /
-- token_symbol / token_decimals) are left at their defaults — set them from the app afterwards
-- (Airdrop → Manage → edit), which is the normal metadata PATCH path.
--
-- Safe to re-run: ON CONFLICT (id) DO NOTHING, and the poller's own upsert is ignoreDuplicates,
-- so whichever writes the row first wins and the other is a no-op.

insert into airdrop_campaigns (
    id,
    chain_id,
    creator_wallet,
    token,
    amount_mode,
    fixed_amount,
    min_amount,
    max_amount,
    total_amount,
    remaining_amount,
    max_claimants,
    claimed_count,
    expires_at,
    gas_mode,
    gas_deposit,
    gas_spent,
    share_hash,
    tx_hash,
    status,
    created_at
) values (
    '0x7b9f7ca194af849210c7c67746a4f180c3a8baa41b1d526c63587f4c4c357ba6',
    96,
    '0xca811301c650c92fd45ed32a81c0b757c61595b6',
    '0xd7d24786e8009259811683e37761e886d9e28894',            -- JPTS (mainnet)
    'fixed',
    100000000000000000000,                                    -- 100 JPTS per claim
    null,
    null,
    30000000000000000000000,                                  -- 30,000 JPTS total
    30000000000000000000000,                                  -- nothing claimed yet (claimedCount == 0 on-chain)
    300,
    0,
    to_timestamp(1787936400),                                 -- expiresAt from the contract
    'self',
    0,
    0,
    'e21201dedb060898',                                        -- keccak256(campaignId)[2..18], see lib/onchain/airdrop-share.ts
    '0xd8a06f0c0f5cc3aa94f4bdf83d39abb80716888cf049979c413601a9a92f1c2c',
    'active',
    to_timestamp(1787843005)                                  -- block 34735091 timestamp
)
on conflict (id) do nothing;

-- Provenance entry, mirroring the poller's logAirdropAudit for airdrop.campaign_created.
insert into audit_logs (
    category, action, actor_type, subject_type, subject_id, chain_id, new_status, tx_hash, block_number, metadata
)
select
    'sync', 'airdrop.campaign_created', 'system', 'airdrop_campaign',
    '0x7b9f7ca194af849210c7c67746a4f180c3a8baa41b1d526c63587f4c4c357ba6',
    96, 'active',
    '0xd8a06f0c0f5cc3aa94f4bdf83d39abb80716888cf049979c413601a9a92f1c2c',
    34735091,
    jsonb_build_object('backfill', true)
where not exists (
    select 1 from audit_logs
    where action = 'airdrop.campaign_created'
      and subject_id = '0x7b9f7ca194af849210c7c67746a4f180c3a8baa41b1d526c63587f4c4c357ba6'
);
