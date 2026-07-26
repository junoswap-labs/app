-- Base schema. Migrations 0002-0004 were written before this one existed and already assume
-- these tables — column names/types here are reconstructed to match every reference they make
-- (0002: users.wallet_address FK; 0003: nft_orders/rwa_orders columns + status values used in
-- the analytics views; 0004: nft_metadata_cache, created independently, unaffected by this file).
--
-- Roles are NOT stored here. Admin/Partner/Authorize are read live from PermissionRegistry.sol
-- on-chain (see contracts/) — this table is only an identity/audit FK target, never a permission
-- source. See 0003 for the now-removed DB role column this superseded.

create table users (
  wallet_address text primary key,     -- lowercase
  created_at     timestamptz not null default now()
);

-- One row per off-chain signed Order (EIP-712) that has been submitted for discovery.
-- order_hash = NftMarketplace.sol's hashOrder(order) = keccak256(abi.encode(order)) — NOT the
-- EIP-712 digest the seller signs (orderDigest), see contracts/src/NftMarketplace.sol.
create table nft_orders (
  order_hash     text primary key,     -- 0x-prefixed bytes32, matches hashOrder(order) exactly
  seller         text not null references users(wallet_address),
  buyer          text references users(wallet_address),
  nft_contract   text not null,        -- lowercase
  token_id       numeric not null,
  payment_token  text not null,        -- lowercase ERC20 address
  price          numeric not null,     -- base units
  nonce          numeric not null,
  expiry         bigint not null,      -- unix seconds, matches Order.expiry
  signature      text not null,
  status         text not null default 'active',  -- 'active' | 'filled' | 'cancelled'
  fee            numeric,              -- written by the poller from OrderFulfilled.fee
  name           text,                 -- denormalized display cache
  image_url      text,
  listed_at      timestamptz not null default now(),
  filled_at      timestamptz,
  cancelled_at   timestamptz
);
create index nft_orders_status_idx on nft_orders (status, listed_at desc);
create index nft_orders_contract_idx on nft_orders (nft_contract, status);
create index nft_orders_seller_idx on nft_orders (seller, status);

-- Pre-funding catalog row (what a seller lists before anyone buys). Split from rwa_orders
-- (the escrow transaction record once funded) because a listing can exist with no order yet,
-- and 0003_admin_role_and_analytics.sql already queries rwa_listings.status = 'active'
-- separately from rwa_orders.status values, which only make sense once RwaEscrow.fund() runs.
create table rwa_listings (
  id             text primary key,     -- bytes32 listingId, minted by the backend at list time
  seller_wallet  text not null references users(wallet_address),
  title          text not null,
  description    text not null default '',
  image_urls     text[] not null default '{}',
  price          numeric not null,     -- base units
  payment_token  text not null,
  status         text not null default 'active',  -- 'active' | 'cancelled' | 'funded'
  created_at     timestamptz not null default now()
);
create index rwa_listings_status_idx on rwa_listings (status, created_at desc);
create index rwa_listings_seller_idx on rwa_listings (seller_wallet, status);

-- The escrow transaction record once RwaEscrow.fund() is called. Status values are exact
-- PascalCase matches of RwaEscrow.sol's Status enum (contracts/src/RwaEscrow.sol) because
-- 0003_admin_role_and_analytics.sql's analytics views already filter on those exact strings
-- (status in ('Completed','ResolvedSeller') etc.) — do not lowercase these.
create table rwa_orders (
  id             text primary key references rwa_listings(id),
  seller_wallet  text not null references users(wallet_address),
  buyer_wallet   text not null references users(wallet_address),
  payment_token  text not null,
  amount         numeric not null,
  status         text not null,        -- 'Funded'|'Shipped'|'Completed'|'Refunded'|'Disputed'|'ResolvedSeller'|'ResolvedBuyer'
  fee            numeric,              -- written by the poller from RwaCompleted.fee / resolveDispute payout
  funded_at      timestamptz not null,
  shipped_at     timestamptz,
  completed_at   timestamptz,          -- ordinary confirmReceived() or claimShipmentTimeout() completion
  resolved_at    timestamptz           -- resolveDispute() outcome
);
create index rwa_orders_status_idx on rwa_orders (status);
create index rwa_orders_seller_idx on rwa_orders (seller_wallet, status);

alter table users enable row level security;
alter table nft_orders enable row level security;
alter table rwa_listings enable row level security;
alter table rwa_orders enable row level security;

-- Public read for discovery/browse; all writes go through the service role only (Route Handlers
-- / sync poller), same convention as nft_metadata_cache in 0004.
create policy "nft_orders public read" on nft_orders for select using (true);
create policy "rwa_listings public read" on rwa_listings for select using (true);
create policy "rwa_orders public read" on rwa_orders for select using (true);
-- users/wallet_address rows are not browsed directly by anyone — no public read policy.
