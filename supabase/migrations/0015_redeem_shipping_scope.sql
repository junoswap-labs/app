-- Whether a merch item ships only inside Thailand. Default false (worldwide) so existing listings
-- keep their current behaviour; a lister opts in per item.
-- Enforced on order creation (app/api/redeem/orders) rather than by a constraint, because the
-- destination lives in redemption_orders.shipping's jsonb payload, not in a column.
alter table redeem_items add column if not exists thailand_only boolean not null default false;
