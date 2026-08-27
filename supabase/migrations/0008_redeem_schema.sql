-- Redeem catalog schema — Points + ERC20/KAP20 -> NFT/merch, per docs/Marketplace_Redeem_Feature.md.
-- NFT-kind items settle atomically via contracts/src/RedeemNftSettlement.sol (signed RedeemOffer;
-- this table's `id` IS that contract's uint256 itemId — bigint identity keeps the two in lockstep).
-- Merch-kind items reuse RwaEscrow.sol directly (a second deployment dedicated to Redeem, see
-- .env.example's NEXT_PUBLIC_REDEEM_RWA_ESCROW_ADDRESS) instead of a bespoke escrow contract —
-- redemption_orders.escrow_listing_id is that contract's fund() listingId, minted here exactly
-- like rwa_listings.id already is for the Marketplace flow (0001_base_schema.sql).

create table redeem_items (
  id                bigint generated always as identity primary key,
  tier              text not null,          -- 'official' | 'registered'
  kind              text not null,          -- 'nft' | 'merch'
  lister_wallet     text not null references users(wallet_address),
  name              text not null,
  description       text not null default '',
  image_urls        text[] not null default '{}',
  price_points      numeric not null default 0,
  payment_token         text,               -- lowercase ERC20/KAP20 address; null = points-only item
  payment_token_symbol  text,
  payment_amount        numeric,            -- base units, paired with payment_token
  -- Registered tier only — RedeemNftSettlement.RedeemOffer.payoutWallet / RwaEscrow's `seller` param.
  -- Official items leave this null: proceeds settle entirely with the platform treasury.
  payout_wallet     text,
  -- NFT kind only: the token this item settles through RedeemNftSettlement.redeem(). Registered-tier
  -- NFTs must already be deposited ("vaulted") into that contract's `treasury` address and approved
  -- before a listing can go live — enforced at the application layer (app/api/redeem/items), not a
  -- DB constraint, same reasoning as the collection-registry check for Marketplace NFT listings.
  nft_contract      text,
  nft_token_id      numeric,
  -- Stock at the item level only applies when the item has no variant rows (see
  -- redeem_item_variants below). null = unlimited.
  stock             integer,
  publish_at        timestamptz,
  redeem_start_at   timestamptz,
  redeem_end_at     timestamptz,
  status            text not null default 'draft',  -- 'draft' | 'published' | 'archived'
  created_at        timestamptz not null default now()
);

create index redeem_items_tier_kind_idx on redeem_items (tier, kind, status);
create index redeem_items_lister_idx on redeem_items (lister_wallet, status);

-- Size/color-style options. An item with no rows here uses redeem_items.stock directly; an item
-- with rows here ignores redeem_items.stock and tracks per-variant instead (enforced by the
-- create/redeem Route Handlers, not a DB constraint — see app/api/redeem/items, app/api/redeem/orders).
create table redeem_item_variants (
  id          bigint generated always as identity primary key,
  item_id     bigint not null references redeem_items(id) on delete cascade,
  label       text not null,       -- e.g. "Size L / Black"
  sku         text,
  stock       integer,             -- null = unlimited
  created_at  timestamptz not null default now()
);

create index redeem_item_variants_item_idx on redeem_item_variants (item_id);

create table redemption_orders (
  id                    uuid primary key default gen_random_uuid(),
  item_id               bigint not null references redeem_items(id),
  variant_id            bigint references redeem_item_variants(id),
  buyer_wallet          text not null references users(wallet_address),
  tier                  text not null,
  kind                  text not null,
  price_points          numeric not null default 0,
  payment_token         text,
  payment_token_symbol  text,
  payment_amount        numeric,
  -- NFT kind: RedeemNftSettlement.hashOffer(offer) — the redeemed[] mapping key, once settled.
  offer_hash            text,
  -- merch kind: the RwaEscrow listingId minted here at order-creation time, matching rwa_listings.id's
  -- own convention (minted by the backend, not derived on-chain) — passed as fund()'s listingId.
  escrow_listing_id     text,
  -- 'PendingPayment' is written here by the order-creation Route Handler, before the buyer's wallet
  -- has sent the on-chain tx. Every other value is written ONLY by the sync poller (never by an API
  -- route), per CLAUDE.md's Clean Workflow rule. NFT kind settles atomically ('PendingPayment' ->
  -- 'Completed' off RedeemNftSettlement's NftRedeemed event); merch kind mirrors RwaEscrow.sol's own
  -- Status enum from 'Funded' onward (same reasoning as rwa_orders.status in 0001_base_schema.sql):
  -- 'PendingPayment' | 'Funded' | 'Shipped' | 'Completed' | 'Refunded' | 'Disputed'
  -- | 'ResolvedSeller' | 'ResolvedBuyer'.
  status                text not null default 'PendingPayment',
  shipping              jsonb,
  tracking_number       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  shipped_at            timestamptz,
  completed_at          timestamptz,
  resolved_at           timestamptz
);

create index redemption_orders_buyer_idx on redemption_orders (buyer_wallet, status);
create index redemption_orders_item_idx on redemption_orders (item_id, status);
create index redemption_orders_status_idx on redemption_orders (status, created_at desc);

alter table redeem_items enable row level security;
alter table redeem_item_variants enable row level security;
alter table redemption_orders enable row level security;

-- Catalog is browsed directly from the client (same convention as rwa_listings/collections) — only
-- published items are publicly visible; draft/archived stay hidden until the Route Handler flips
-- status. Writes always go through Route Handlers using the service role.
create policy "redeem_items public read" on redeem_items for select using (status = 'published');
create policy "redeem_item_variants public read" on redeem_item_variants for select using (
  exists (select 1 from redeem_items i where i.id = item_id and i.status = 'published')
);
-- redemption_orders carries shipping PII — no public read policy, same convention as `applications`;
-- reads go through Route Handlers (own orders, or the lister/admin fulfillment queue) using the
-- service role, gated by the session wallet (+ a live on-chain role check for the queue).

-- ---------------------------------------------------------------------------------------------
-- Connect (Google/Telegram notifications) — replaces store/mock-settings.ts's mock fields.
alter table users add column if not exists google_email                  text;
alter table users add column if not exists google_linked_at              timestamptz;
alter table users add column if not exists telegram_chat_id              text;
alter table users add column if not exists telegram_username             text;
alter table users add column if not exists telegram_linked_at            timestamptz;
-- Short-lived pairing code for the t.me deep-link flow (see app/api/telegram/start-link) — cleared
-- once telegram_chat_id is set.
alter table users add column if not exists telegram_link_code            text;
alter table users add column if not exists telegram_link_code_expires_at timestamptz;
alter table users add column if not exists notify_new_offer              boolean not null default true;
alter table users add column if not exists notify_deadline               boolean not null default true;

create unique index if not exists users_telegram_link_code_idx on users (telegram_link_code)
  where telegram_link_code is not null;

-- ---------------------------------------------------------------------------------------------
-- "List By" branding — a Registered (Partner-Redeem) lister's own display name + logo, editable
-- from /app/settings (gated by the live on-chain PARTNER_REDEEM_ROLE, see
-- app/api/redeem/lister-profile). Stored on `users` since it's identity data, not a redeem_items
-- column, so updating it retroactively re-brands every one of that lister's existing listings.
alter table users add column if not exists lister_display_name text;
alter table users add column if not exists lister_logo_url    text; -- IPFS URL, same upload pipeline as item photos

-- `users` itself has no public-read policy (it can carry google_email etc. — see
-- 0001_base_schema.sql's header comment), so catalog pages read the "List By" name/logo through
-- this narrow view instead of the table directly. Nothing outside these 3 columns is exposed.
create view redeem_lister_profiles as
  select wallet_address, lister_display_name, lister_logo_url
  from users
  where lister_display_name is not null or lister_logo_url is not null;

grant select on redeem_lister_profiles to anon, authenticated;
