-- Caps how many times a single wallet may redeem a given item. Null = unlimited (default —
-- existing listings keep their current unlimited behaviour). Enforced app-side only, in
-- app/api/redeem/orders/route.ts, at order-creation time — not a smart-contract constraint.
alter table redeem_items add column if not exists max_per_wallet integer;
