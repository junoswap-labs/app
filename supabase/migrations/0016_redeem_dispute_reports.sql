-- Off-chain evidence for a Redeem merch dispute. RwaEscrow.sol's openDispute() only flips a status
-- flag on-chain (no reason/evidence param) — this carries the "why" for the admin/arbitrator queue.
-- reason is one of 'fake_shipment' (buyer: tracking is bogus / nothing arrived) or
-- 'buyer_unresponsive' (seller: buyer won't confirm receipt) — see report-dispute-dialog.tsx.
alter table redemption_orders
  add column if not exists dispute_reason text,
  add column if not exists dispute_detail text,
  add column if not exists dispute_evidence_urls text[],
  add column if not exists dispute_reported_by text,
  add column if not exists dispute_reported_at timestamptz;
