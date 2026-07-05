-- Admin role + analytics
-- 1) DB role สำหรับ gate "ฟังก์ชันพิเศษ" (analytics dashboard ฯลฯ) ฝั่ง UI/อ่านข้อมูล
--    หมายเหตุ: role นี้คนละชั้นกับ on-chain ARBITRATOR_ROLE — การ resolve dispute ที่ขยับเงินจริง
--    ถูกบังคับโดย contract เท่านั้น (ดู smartcontract-plan ข้อ 2) role ใน DB ใช้แค่คุมการ "เห็น/เข้า" ฟีเจอร์
-- 2) คอลัมน์ fee ที่ poller เขียนจาก event (OrderFulfilled.fee / RwaCompleted.fee) เพื่อให้ analytics รวม fee ได้
-- 3) analytics views — อ่านผ่าน service role ใน Route Handler เท่านั้น (revoke จาก anon/authenticated ไว้)

-- 1) admin role -----------------------------------------------------------
alter table users
  add column if not exists role text not null default 'user';   -- 'user' | 'admin' | 'arbitrator'

-- 2) fee provenance -------------------------------------------------------
-- poller เขียนค่าจาก event ตอน flip status; เก็บเป็นหน่วยเดียวกับ price/amount (token base units)
alter table nft_orders add column if not exists fee numeric;     -- จาก OrderFulfilled.fee
alter table rwa_orders add column if not exists fee numeric;     -- จาก RwaCompleted.fee / resolveDispute(releaseToSeller)

-- 3) analytics views ------------------------------------------------------
-- "ขายสำเร็จ" = NFT status='filled' และ RWA status in ('Completed','ResolvedSeller')
-- (Refunded/ResolvedBuyer ไม่นับเป็นยอดขาย เพราะเงินไม่ได้ไปถึง seller)
-- volume สรุปต่อ "token" เท่านั้น — ห้ามรวมข้าม token (คนละสกุล รวมกันไม่มีความหมาย)

create or replace view analytics_sales_by_token as
with nft as (
  select payment_token as token,
         count(*)               as nft_items,
         sum(price)             as nft_volume,
         sum(coalesce(fee, 0))  as nft_fee
  from nft_orders where status = 'filled'
  group by payment_token
),
rwa as (
  select payment_token as token,
         count(*)               as rwa_items,
         sum(amount)            as rwa_volume,
         sum(coalesce(fee, 0))  as rwa_fee
  from rwa_orders where status in ('Completed', 'ResolvedSeller')
  group by payment_token
)
select
  coalesce(nft.token, rwa.token)                            as token,
  coalesce(nft.nft_items, 0)                                as nft_items,
  coalesce(rwa.rwa_items, 0)                                as rwa_items,
  coalesce(nft.nft_items, 0) + coalesce(rwa.rwa_items, 0)   as total_items,
  coalesce(nft.nft_volume, 0)                               as nft_volume,
  coalesce(rwa.rwa_volume, 0)                               as rwa_volume,
  coalesce(nft.nft_volume, 0) + coalesce(rwa.rwa_volume, 0) as total_volume,
  coalesce(nft.nft_fee, 0)                                  as nft_fee,
  coalesce(rwa.rwa_fee, 0)                                  as rwa_fee,
  coalesce(nft.nft_fee, 0) + coalesce(rwa.rwa_fee, 0)       as total_fee
from nft full outer join rwa on nft.token = rwa.token;

-- ตัวเลขสรุปหน้า Overall ที่ "รวมข้าม token ได้" (เป็นจำนวนนับ ไม่ใช่มูลค่า)
create or replace view analytics_overview as
select
  (select count(*) from nft_orders where status = 'filled')
    + (select count(*) from rwa_orders where status in ('Completed', 'ResolvedSeller')) as total_items_sold,
  (select count(*) from nft_orders where status = 'filled')                              as nft_items_sold,
  (select count(*) from rwa_orders where status in ('Completed', 'ResolvedSeller'))      as rwa_items_sold,
  (select count(*) from nft_orders where status = 'active')                              as active_nft_listings,
  (select count(*) from rwa_listings where status = 'active')                            as active_rwa_listings,
  (select count(*) from users)                                                           as total_users,
  (select count(*) from rwa_orders where status = 'Funded')                              as rwa_funded,
  (select count(*) from rwa_orders where status = 'Shipped')                             as rwa_shipped,
  (select count(*) from rwa_orders where status = 'Refunded')                            as rwa_refunded,
  (select count(*) from rwa_orders where status = 'Disputed')                            as open_disputes;

-- ยอดขายรายวันต่อ source/token — สำหรับ render เป็น time-series table
create or replace view analytics_daily_sales as
select date_trunc('day', filled_at)::date as day,
       'nft'::text                         as source,
       payment_token                       as token,
       count(*)                            as items,
       sum(price)                          as volume,
       sum(coalesce(fee, 0))               as fee
from nft_orders
where status = 'filled' and filled_at is not null
group by 1, 3
union all
select date_trunc('day', coalesce(completed_at, resolved_at))::date,  -- ResolvedSeller ใช้ resolved_at
       'rwa'::text,
       payment_token,
       count(*),
       sum(amount),
       sum(coalesce(fee, 0))
from rwa_orders
where status in ('Completed', 'ResolvedSeller') and coalesce(completed_at, resolved_at) is not null
group by 1, 3;

-- อันดับผู้ขาย (รวม NFT+RWA) ต่อ token
create or replace view analytics_top_sellers as
select wallet, token, sum(items) as items, sum(volume) as volume, sum(fee) as fee
from (
  select seller        as wallet, payment_token as token, count(*) as items, sum(price)  as volume, sum(coalesce(fee, 0)) as fee
  from nft_orders where status = 'filled' group by seller, payment_token
  union all
  select seller_wallet as wallet, payment_token as token, count(*) as items, sum(amount) as volume, sum(coalesce(fee, 0)) as fee
  from rwa_orders where status in ('Completed', 'ResolvedSeller') group by seller_wallet, payment_token
) s
group by wallet, token;

-- อันดับ NFT collection ที่ขายดี ต่อ token
create or replace view analytics_top_collections as
select nft_contract, payment_token as token, count(*) as items, sum(price) as volume, sum(coalesce(fee, 0)) as fee
from nft_orders where status = 'filled'
group by nft_contract, payment_token;

-- views เปิดอ่านผ่าน service role (Route Handler) เท่านั้น — ปิด client ทั้งหมด
revoke all on analytics_sales_by_token, analytics_overview, analytics_daily_sales,
  analytics_top_sellers, analytics_top_collections
  from anon, authenticated;
