-- Audit log — append-only trail ของทุก action ที่ "เปลี่ยนสถานะ/ข้อมูลสำคัญ" ในระบบ
-- ครอบ 5 แหล่ง: admin/arbitrator, sync poller (on-chain → DB), client off-chain writes, auth/linking, telegram bot
--
-- กฎเหล็กของ repo: actor_wallet ต้องมาจาก verified session ฝั่ง server เท่านั้น
-- ห้าม insert แถวนี้จาก client โดยตรง (anon key) และห้ามเชื่อ wallet_address ที่ client ส่งมา
-- การเขียนทุกแถวทำผ่าน service role ใน Route Handler / sync poller เท่านั้น

create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  category      text not null,          -- 'admin' | 'sync' | 'client' | 'auth' | 'bot'
  action        text not null,          -- เช่น 'dispute.resolve', 'order.status_change', 'listing.create', 'auth.verify_wallet', 'bot.webhook_received', 'bot.message_sent', 'bot.error'

  actor_wallet  text references users(wallet_address),  -- คนที่ทำ; null ได้ถ้าเป็น system/sync
  actor_type    text not null,          -- 'user' | 'admin' | 'system'

  subject_type  text,                   -- 'nft_order' | 'rwa_order' | 'rwa_listing' | 'user' | 'dispute'
  subject_id    text,                   -- order_hash / listing_id / wallet_address ของ subject

  old_status    text,                   -- สถานะก่อนเปลี่ยน (เฉพาะ action ที่ flip status)
  new_status    text,                   -- สถานะหลังเปลี่ยน

  -- on-chain provenance: ผูก audit entry กลับไปยัง event/tx จริง สำหรับ category='sync'
  tx_hash       text,
  block_number  bigint,
  log_index     integer,

  -- request provenance สำหรับ category='client'/'auth' (มาจาก server, ไม่ใช่ค่าที่ client ตั้งเอง)
  request_ip    text,
  user_agent    text,

  -- Telegram update_id สำหรับ category='bot' — ใช้ dedup webhook ที่ถูกส่งซ้ำตอน bot restart/timeout
  tg_update_id  bigint,

  metadata      jsonb                   -- payload เพิ่มเติมแบบ free-form (เช่น dispute resolution reason, diff, raw update)
);

-- index ตาม subject เพื่อดึง timeline ของ order/listing เดียว และตาม category สำหรับ admin dashboard
create index audit_logs_subject_idx on audit_logs (subject_type, subject_id, created_at desc);
create index audit_logs_category_idx on audit_logs (category, created_at desc);
create index audit_logs_actor_idx on audit_logs (actor_wallet, created_at desc);

-- ป้องกัน duplicate เมื่อ sync poller รัน event เดิมซ้ำ (cron + on-demand refresh อาจประมวลผล log เดียวกัน)
-- log บน-chain แต่ละตัวระบุได้ unique ด้วย (tx_hash, log_index)
create unique index audit_logs_onchain_dedup_idx
  on audit_logs (tx_hash, log_index)
  where tx_hash is not null and log_index is not null;

-- กัน webhook ซ้ำ: Telegram ส่ง update เดิมซ้ำได้ถ้า bot ไม่ตอบ 200 ทัน (เช่นช่วง shutdown/restart)
-- insert audit ของ category='bot' แบบ `on conflict (tg_update_id) do nothing` แล้วค่อยประมวลผล update นั้น
create unique index audit_logs_tg_update_dedup_idx
  on audit_logs (tg_update_id)
  where tg_update_id is not null;

alter table audit_logs enable row level security;

-- ไม่มี policy ฝั่ง anon/authenticated เลย = client (anon key) อ่าน/เขียนไม่ได้ทั้งหมด
-- service role bypass RLS อยู่แล้ว จึงเป็นผู้เขียนเพียงรายเดียว
-- การอ่านสำหรับหน้า admin/timeline ทำผ่าน Route Handler ที่ใช้ service role + เช็คสิทธิ์เอง
