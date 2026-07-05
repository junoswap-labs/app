# CLAUDE.md

## Project

Junoswap Marketplace — NFT and Real-World-Asset (RWA) trading platform, paid in ERC20 tokens, on Bitkub Chain (kub, chainId 96 mainnet / 25925 testnet) only. Brand/design forked from `junoswap` but a fully separate codebase and deployment (`marketplace.junoswap.trade`). **Never modify the `junoswap` repo** — this repo only copies from it, one-way.

Planning docs: `Docs/frontend-plan.md`, `Docs/backend-plan.md`, `Docs/smartcontract-plan.md`. ABI names, endpoint paths, and Supabase column names must match across all three exactly.

## Directory map

app/                       Next.js App Router pages — `app/marketplace/` is the actual product, `app/page.tsx` just redirects there
components/marketplace/    Shell (header/nav)
components/nft/            nft-card, list-nft-dialog, buy-nft-dialog
components/rwa/            rwa-card, list-rwa-dialog, order-status-tracker, ship-deadline-countdown, dispute-dialog
components/settings/       google-link-card, telegram-link-card
components/admin/          dispute-queue-table, resolve-dispute-dialog
components/ui/, components/web3/   Forked verbatim (or lightly trimmed) from junoswap — see "Forked from junoswap" below
hooks/                     wagmi-only — useListNftOrder, useFulfillNftOrder, useFundRwaOrder, useMarkShipped, useConfirmReceived, useClaimRefund, useOpenDispute, useResolveDispute, useSyncRefresh
services/marketplace/      Pure logic, no React — nft-order.ts (EIP-712 payload), rwa-order.ts (client-side state-machine guard for UX only), fee.ts
store/                     Zustand — UI state only (filters/sort/dialogs). **Never order/escrow status** — that always comes from the server.
lib/                       wagmi.ts, eip712.ts, supabase-client.ts (anon key, public reads only), abis/, explorer.ts, toast.ts, utils.ts
types/                     marketplace.ts (NftOrderRow), rwa.ts (RwaOrderRow, RwaStatus)
contracts/                 Foundry Solidity project — git submodule (NFT marketplace + RWA escrow)
Docs/                      Planning docs (frontend/backend/smartcontract plans)

## Key conventions

- Runtime: **bun only** — never use npm, yarn, or pnpm.
- Language: **100% English everywhere in the product** — all UI text, labels, buttons, dialogs, toasts, empty states, error messages, and code comments must be in English. No Thai (or any other language) in user-facing strings, ever.
- Tests: test business logic, not framework behavior — skip tautologies, passthroughs, exact duplicates, and trivial defaults. `services/marketplace/*` is the main test target (EIP-712 payload correctness, fee calc, state-machine guard rejecting invalid transitions).
- Comments: comment only genuinely complex or non-obvious code — the *why*, gotchas, workarounds, magic-value/address decoders, sign conventions, contract-ABI correspondences, and math derivations. Do NOT add section-divider banners, one-word grouping labels, JSDoc that restates the function/type name, or inline narration of self-evident code.

## Clean workflow — the rule that governs this whole repo

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
- `public/chains/kubchain.png` (chain icon used by `NetworkSwitcher`) still needs to be copied over from junoswap's `public/` folder — binary copy wasn't possible in the environment this scaffold was built in. Copy it manually before the icon will render.
