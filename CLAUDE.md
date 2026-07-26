# CLAUDE.md

## Project

Junoswap Marketplace — NFT and Real-World-Asset (RWA) trading platform, paid in ERC20 tokens, on Bitkub Chain (kub, chainId 96 mainnet / 25925 testnet) only. Brand/design forked from `junoswap` but a fully separate codebase and deployment (`marketplace.junoswap.trade`). **Never modify the `junoswap` repo** — this repo only copies from it, one-way.

Current active development scope: **Marketplace** (NFT + RWA trading) and **Redeem** (Points + ERC20 → NFT/merch). Adjacent features already scaffolded in this repo — Rebate/staking, Launchpad creator-fee, KYC, admin analytics — share the same stack but aren't part of this scope.

**The frontend UI is built; the backend/on-chain wiring is not.** Every stateful action today runs on Zustand mock stores (`store/mock-*.ts`) plus a fake `mockTx()` delay standing in for real transactions — there is no `app/api/*` directory, no Supabase client anywhere in the code, and the Supabase migrations that do exist reference tables no migration creates. See `docs/Marketplace_Redeem_Feature.md` for the full current-state reference (gitignored under `/Docs` in `.gitignore`, not committed — local reference only, regenerate/update it by hand as the code changes). Don't assume ABI names, endpoint paths, or Supabase columns exist just because a comment or an older doc references them — verify against actual files first.

## Directory map

app/                       Next.js App Router — the real product lives under `app/app/*` (URL prefix `/app/*`: `/app`, `/app/nft/list`, `/app/nft/[orderHash]`, `/app/rwa/list`, `/app/rwa/[listingId]`, `/app/orders`, `/app/redeem`, `/app/redeem/orders`, `/app/admin`, `/app/settings`). `app/marketplace/*` is a **legacy redirect-only shim** (every page.tsx is `redirect('/app/...')`). `app/page.tsx` redirects to `/app`. `app/launchpad/creator-fee/` is a separate feature, out of scope here. **No `app/api/*` route handlers exist anywhere yet.**
components/marketplace/    Shell — header.tsx only
components/nft/            nft-card, nft-grid, listing-toolbar, buy-nft-dialog (listing happens on the /app/nft/list page directly, no separate list dialog)
components/rwa/            rwa-card, rwa-grid, order-status-tracker, ship-deadline-countdown (dispute UI is inline in these, not a separate dialog)
components/redeem/         redeem-dialog, redeem-item-card, redemption-status-tracker
components/settings/       google-link-card, telegram-link-card
components/admin/          dispute-queue-table, redemption-queue, kyc-queue, analytics-dashboard
components/kyc/, components/rebate/, components/launchpad/   Adjacent features (out of Marketplace/Redeem scope)
components/ui/, components/web3/   Forked verbatim (or lightly trimmed) from junoswap — see "Forked from junoswap" below
hooks/                     useListings.ts, useNftMetadata.ts (Marketplace) · useCurrentUser.ts, useAnalytics.ts (shared) · useClaimCreatorFee.ts, useCreatorFeeClaims.ts (Launchpad). Today these are mostly thin wrappers over the mock stores below — **no wagmi write hooks exist yet** (no useListNftOrder/useFulfillNftOrder/useFundRwaOrder/etc., no useSyncRefresh — those are target-design names from an earlier draft of this file, not real code).
services/marketplace/      Pure logic, no React, all real (not mock) — fee.ts, listing-query.ts, nft-metadata.ts (tokenURI/IPFS resolution, the one fully-real on-chain-reading path), rwa-order.ts (client-side state-machine guard for UX only, mirrors RwaEscrow.sol exactly) · creator-fee/ (Launchpad, real + tested, out of scope). No EIP-712 signing helper (`nft-order.ts`) exists yet.
store/                     Zustand + `persist` (→ localStorage) — mock-listings.ts, mock-rwa.ts, mock-redemptions.ts, etc. Every file opens with an explicit `// MOCK only` comment. **This is a temporary stand-in, not the permanent architecture** — once real, order/escrow status must never be trusted from a client write again (see "Clean workflow" below).
lib/                       wagmi.ts, ipfs.ts, nft-collections.ts, nft-metadata-cache.ts, explorer.ts, toast.ts, utils.ts, image.ts, abis/ (only erc721.ts + creator-fee-distributor.ts exist — **no marketplace/RWA-escrow ABI yet**), mock/ (tx.ts — the `mockTx()` stand-in for writeContract — plus redeem.ts, rebate.ts). No eip712.ts, no supabase-client.ts.
types/                     marketplace.ts (NftListing), rwa.ts (RwaListing, RwaStatus), redeem.ts (RedeemItem, RedemptionOrder, RedemptionStatus), nft.ts, plus kyc.ts/rebate.ts/analytics.ts/creator-fee.ts/web3.ts for adjacent features
contracts/                 Foundry Solidity project, tracked directly in this repo (**not** a git submodule) — NftMarketplace.sol (gasless EIP-712 signed orders), RwaEscrow.sol (custodial escrow, fund→ship→confirm + refund/dispute), CreatorFeeDistributor.sol (Launchpad). None are deployed yet; no deploy script exists for the first two.
supabase/migrations/       0002-0004 exist but reference base tables (`users`, `nft_orders`, `rwa_orders`, `rwa_listings`) that **no migration creates** — the schema is incomplete even on paper. No `redemptions` table exists for Redeem at all.
docs/                      `Marketplace_Redeem_Feature.md` — current-state reference doc for Marketplace + Redeem (gitignored via `/Docs` in `.gitignore`, Windows filesystem makes `docs/`/`Docs/` the same dir — not committed, keep it updated by hand).

## Key conventions

- Runtime: **bun only** — never use npm, yarn, or pnpm.
- Language: **100% English everywhere in the product** — all UI text, labels, buttons, dialogs, toasts, empty states, error messages, and code comments must be in English. No Thai (or any other language) in user-facing strings, ever.
- Tests: test business logic, not framework behavior — skip tautologies, passthroughs, exact duplicates, and trivial defaults. `services/marketplace/*` is the main test target (EIP-712 payload correctness, fee calc, state-machine guard rejecting invalid transitions).
- Comments: comment only genuinely complex or non-obvious code — the *why*, gotchas, workarounds, magic-value/address decoders, sign conventions, contract-ABI correspondences, and math derivations. Do NOT add section-divider banners, one-word grouping labels, JSDoc that restates the function/type name, or inline narration of self-evident code.

## Clean workflow — the rule that governs this whole repo

**Target design — not implemented yet.** No sync poller, no `/api/sync/refresh`, no Supabase client exist today; every action currently mutates a local Zustand mock store directly (see `store/` above). This section describes how it must work once the backend is real — follow it for any new code that replaces a mock, don't assume the infrastructure it describes already exists.

Order/escrow status is **never** trusted from a client write or asserted client-side after a tx confirms. The lightweight on-chain sync poller (custom `getLogs` polling, not an indexer framework) is the only writer of status columns in Supabase. After any `writeContract` call:

1. Wait for tx confirmation.
2. Call `useSyncRefresh()` (`POST /api/sync/refresh`) to nudge the poller.
3. Invalidate the relevant React Query keys and re-fetch from Supabase.
4. If status hasn't updated yet (poller lag), poll again 2-3 times a few seconds apart with a "confirming on-chain" loading state — never flip local UI to "success" from the tx receipt alone.

Client-side checks in `services/marketplace/*-order.ts` (e.g. disabling a button that would obviously revert) exist for UX only. The contract's `require`/modifier is the only real source of truth — never relax a contract check because "the frontend already validated it."

## Forked from junoswap

`components/ui/*` is copied verbatim. `components/web3/*` (connect-button, connect-modal, jazzicon, network-switcher) is copied verbatim except `account-dropdown.tsx`, which has Multi-Send/Send stripped (out of scope here). `lib/wagmi.ts` keeps junoswap's `createConfig`/`cookieStorage`/`chainMetadata` shape but only lists `bitkub` + `kubTestnet` — every other chain junoswap supports is deliberately absent. Font is next/font Inter rather than junoswap's exact font setup; this is an intentional, accepted visual deviation.

## Notes

- **kub mainnet/testnet RPC** (`rpc.bitkubchain.io`) is NOT a full archive node. Historical `eth_call` reads fail with "missing trie node".
