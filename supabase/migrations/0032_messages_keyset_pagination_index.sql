-- Chat history keyset pagination: supports participant-scoped pages ordered
-- by `created_at DESC, id DESC`. Existing indexes intentionally remain: live
-- inspection found the legacy chat_id index despite migration 0013's DROP,
-- and representative query plans are required before any removal decision.

create index if not exists idx_messages_chat_id_created_at_id
  on public.messages (chat_id, created_at desc, id desc);
