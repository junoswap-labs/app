-- Replaces the hardcoded Record<string, NftCollectionConfig> in lib/nft-collections.ts with a
-- real registry: an NFT contract must have a row here before any of its tokens can be listed on
-- the marketplace (enforced at the product/discovery layer, i.e. where a listing is written —
-- NftMarketplace.sol itself has no collection-allowlist concept and shouldn't grow one, see
-- docs/Marketplace_Redeem_Feature.md Phase 2).

create table collections (
  contract       text not null,          -- lowercase
  chain_id       integer not null,
  name           text not null,
  display_name   text,
  verified       boolean not null default false,
  active         boolean not null default true,   -- admin can retroactively hide an abusive entry
  gateway        text,                    -- custom IPFS gateway override, rarely needed
  registered_by  text references users(wallet_address),
  registered_at  timestamptz not null default now(),
  metadata       jsonb,
  primary key (contract, chain_id)
);

create index collections_active_idx on collections (active, registered_at desc);

alter table collections enable row level security;

-- Metadata isn't secret — public read lets the browse/collection pages query directly via the
-- anon client (lib/supabase/client.ts) without an API round-trip. Writes still go through
-- Route Handlers only (app/api/collections/*), gated by a live on-chain role check.
create policy "collections public read" on collections for select using (true);
