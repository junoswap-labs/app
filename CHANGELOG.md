# Changelog

Notable changes to Junoswap App. Versions follow [semver](https://semver.org); the version shown in
the app footer is `package.json`'s `version` field, rendered from it directly.

Releases are cut with the `ship-version` skill — do not hand-edit a released section afterwards.

## [Unreleased]

## [0.2.0] - 2026-08-24

### Added

- Structured shipping address form (recipient, phone, street, district, province, postal code,
  country) replacing free-text; old orders keep their original free-text address. Merch items can
  be restricted to Thailand-only shipping (migration `0015`), enforced server-side.
- NftMarketplace, RwaEscrow (both deployments), and RedeemNftSettlement deployed to kub-testnet;
  contract/wallet addresses moved out of `.env` into chain-aware `config/contract-addresses.ts`,
  resolved off the wallet's connected chain via `useContractAddresses()`.
- `RwaEscrow.TOKEN_MANAGER_ROLE` lets the Redeem operator wallet auto-allow a payment token on item
  creation without full `DEFAULT_ADMIN_ROLE`. **Requires a redeploy.**
- Buyer/seller dispute reporting for Shipped merch orders (reason + evidence photos, migration
  `0016`), with an Admin Disputes queue section for Redeem merch.
- Per-item "max redemptions per wallet" cap (migration `0017`), enforced on order creation and
  gated client-side.
- Airdrop campaigns can be edited after creation (title, description, cover image, visibility,
  geofence, IP dedupe) at `/app/airdrop/[campaignId]/edit`.
- `AirdropEscrow.endCampaign()` — creator or admin can force-end a live campaign, which also makes
  `reclaim()` available without waiting for an expiry. Closes the case where a campaign created with
  no expiry could never return its unclaimed pool. **Requires a redeploy.**
- Admin: Airdrops tab (moderate or take down a campaign's off-chain content, plus an emergency
  pause for AirdropEscrow), Reports tab, Admins tab (grant/revoke Admin on PermissionRegistry),
  System tab (chain-sync lag + audit log viewer).
- User-facing Report button on airdrop claim pages, backed by the new `content_reports` table
  (migration `0014`).
- Unverified-token warning on claim pages for any token outside `lib/tokens.ts`.
- Notification bell in the header showing recent redemption activity.
- Footer with the running app version and social links.
- Telegram pairing rewritten around a standalone bot service (`telegram-bot-app` repo) with a
  one-wallet-per-chat guarantee (migration `0013`), `/unlink`, and audit logging on link/unlink.
- Every on-chain write now simulates before sending (`useSimulatedWrite`), so a transaction that
  would revert costs nothing and surfaces the contract's own error message.
- Airdrop relayer service: boot-time secret check, constant-time secret comparison, duplicate-claim
  guard, and a `claimFor` simulation before submitting.

### Fixed

- Sync poller advanced only one 5,000-block window per run, so a contract behind the head could
  never catch up — freshly created campaigns stayed unindexed and their metadata could not be saved.
  It now chunks to the head within a time budget, persisting progress per chunk.
- Airdrop metadata no longer depends on the poller: the route seeds the row from an on-chain
  `getCampaign()` read when the event hasn't been indexed yet.
- "My Airdrops" was always empty — the query compared a checksummed wallet address against the
  lowercase value stored in the database.
- "Reclaim gas" was offered on campaigns whose deposit was fully spent, where the transaction can
  only revert.
- Cover images and Redeem item images are restricted to files uploaded through this app; external
  URLs are rejected.
- Stock now decrements on sync-confirmed payment instead of at order creation, so an abandoned
  order can no longer permanently lock a unit.

### Changed

- Google OAuth account linking removed — Telegram is the only linked account.
- Settings and Admin moved out of the header nav into the wallet dropdown.
- React Query defaults (30s `staleTime`, no refetch on window focus) to stop redundant refetches.
- `app/app/airdrop/create/page.tsx` and `app/app/redeem/list/page.tsx` split into smaller
  components (wizard steps, form field groups) — no behavior change.
- Revert-reason decoding consolidated into `lib/toast.ts`'s `errorReason()` for consistent toasts
  across write hooks.

## [0.1.0] - 2026-08-21

First tracked version — the state of the app before this changelog existed.

### Added

- Marketplace (NFT + RWA), Redeem, and Airdrop features on real Supabase data, wagmi write hooks,
  and a `getLogs`-based sync poller.
- Admin console: analytics, disputes, redemptions, authorize/partner queues, contract settings.
- Foundry contracts: NftMarketplace, RwaEscrow (two deployments), RedeemNftSettlement, JunoPts,
  PermissionRegistry, AirdropEscrow, CreatorFeeDistributor.
