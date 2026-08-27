-- Multi-chain: the app now serves every chain in config/contract-addresses.ts simultaneously
-- (kub-testnet 25925 + kub-mainnet 96, and any added later). The sync poller sweeps all of them and
-- every row it writes — plus every row a Route Handler inserts for an on-chain-backed record —
-- carries the originating chain_id so the two chains' data coexist without mixing. Reads
-- (hooks/*, Route Handler GETs) filter by the caller's connected chain.
--
-- Backfill: all data that exists today was written while the app was hard-bound to kub-testnet
-- (the old DEFAULT_CHAIN_ID), so every existing row is chain 25925 — that's the column default,
-- which also keeps any insert path not yet updated from failing the NOT NULL.

alter table nft_orders               add column chain_id bigint not null default 25925;
alter table rwa_listings             add column chain_id bigint not null default 25925;
alter table rwa_orders               add column chain_id bigint not null default 25925;
alter table redeem_items             add column chain_id bigint not null default 25925;
alter table redeem_item_variants     add column chain_id bigint not null default 25925;
alter table redemption_orders        add column chain_id bigint not null default 25925;
alter table airdrop_campaigns        add column chain_id bigint not null default 25925;
alter table airdrop_claims           add column chain_id bigint not null default 25925;
alter table airdrop_claim_attempts   add column chain_id bigint not null default 25925;
alter table airdrop_gas_reimbursements add column chain_id bigint not null default 25925;
alter table audit_logs               add column chain_id bigint;  -- nullable: non-'sync' rows (auth/bot/client) aren't chain-scoped

-- Common read-path filters: "campaigns/orders/items on the chain I'm connected to".
create index nft_orders_chain_idx        on nft_orders (chain_id, status);
create index rwa_listings_chain_idx      on rwa_listings (chain_id, status);
create index redeem_items_chain_idx      on redeem_items (chain_id, status);
create index redemption_orders_chain_idx on redemption_orders (chain_id);
create index airdrop_campaigns_chain_idx on airdrop_campaigns (chain_id, status, created_at desc);
create index airdrop_claims_chain_idx    on airdrop_claims (chain_id, campaign_id);

-- Row keys elsewhere (nft_orders.order_hash, rwa_listings.id / rwa_orders.id,
-- redemption_orders.escrow_listing_id, airdrop_campaigns.id) are backend-minted bytes32 / EIP-712
-- digests that already embed chain-specific inputs — a cross-chain collision is not practically
-- reachable — so their primary keys and dedup indexes are left as-is. The sync handlers still
-- add `.eq('chain_id', ...)` to guarded updates as defense in depth.

-- Poller bookkeeping is now per (chain, contract): the two chains run the same contract names
-- (e.g. 'airdrop_escrow') but track independent last-processed blocks.
alter table sync_state add column chain_id bigint not null default 25925;
alter table sync_state drop constraint sync_state_pkey;
alter table sync_state add primary key (chain_id, contract);
