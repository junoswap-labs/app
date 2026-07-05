-- NFT metadata cache — pre-scan collection แล้วเก็บ "ผลที่ resolve แล้ว" ไว้ใน DB
-- เป้าหมาย: ให้ browse/grid อ่านจากตารางนี้ (paginated) แทนการยิง tokenURI + IPFS ทีละการ์ด
-- เก็บเฉพาะ image_url (ไม่เก็บไฟล์ภาพ) — ภาพยังเสิร์ฟจาก IPFS/โฮสต์เดิมของ collection
--
-- ความสัมพันธ์: นี่คือ source สำหรับ "เลื่อนดู NFT ในคอลเลกชัน". ส่วน "NFT ที่ลงขายจริง"
-- ใช้คอลัมน์ cache ใน nft_orders (ดูแผน optimize) — สองอันเสริมกัน ไม่ทับกัน

create table nft_metadata_cache (
  contract     text not null,          -- lowercase
  token_id     numeric not null,
  name         text,
  image_url    text,                   -- resolve เป็น http(s) แล้ว (จาก ipfs:// ถ้ามี)
  attributes   jsonb,
  token_uri    text,                   -- เก็บ raw ไว้ debug/รีเฟรชภายหลัง
  cached_at    timestamptz not null default now(),
  primary key (contract, token_id)
);

-- ดึงทั้ง collection แบบ paginated เรียงตาม token_id (สำหรับ infinite scroll ฝั่ง browse)
create index nft_metadata_cache_contract_idx on nft_metadata_cache (contract, token_id);

alter table nft_metadata_cache enable row level security;

-- อ่าน public ได้ (metadata ไม่ลับ) — เขียนผ่าน service role (scan job) เท่านั้น
create policy "nft_metadata_cache public read"
  on nft_metadata_cache for select
  using (true);
