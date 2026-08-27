-- One Telegram account can only ever be linked to one wallet. Without this, the same chat_id could
-- be paired to any number of wallets (each pairing goes through a different short-lived link code),
-- which would make every "who do I notify / who is this user" lookup ambiguous.
-- Enforced in the DB rather than only in app/api/telegram/link so a concurrent second /start can't
-- slip between the check and the update.
create unique index if not exists users_telegram_chat_id_idx
  on users (telegram_chat_id)
  where telegram_chat_id is not null;
