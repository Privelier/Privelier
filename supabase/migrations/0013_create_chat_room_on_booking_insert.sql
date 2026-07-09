-- Step 15-16 (chat) — room creation + conversation-read index. Founder
-- decision 2026-07-09: a chat_rooms row exists from the MOMENT a booking is
-- made (status 'pending'), not only after the barber accepts — customer and
-- barber can message each other from booking onward. Design approved in the
-- step 15-16 investigation (same-day founder sign-off on: AFTER INSERT
-- trigger, separate migration, ON CONFLICT DO NOTHING idempotency, backfill,
-- composite messages index).

-- ============================================================
-- 1. Room creation — AFTER INSERT trigger on bookings.
--
-- Nothing created chat_rooms rows before this migration (client code only
-- ever reads them). A DB trigger — not a client-side insert — makes the room
-- atomic with the booking itself: same transaction, so there is never a
-- booking without its room, regardless of which write path created the
-- booking (app, admin tooling, or raw API). Same "the DB is authoritative,
-- clients cannot forget" reasoning as the 0009 double-booking index.
--
-- AFTER INSERT, not BEFORE: chat_rooms.booking_id has an FK to bookings(id),
-- which does not exist yet at BEFORE INSERT time. Kept as its own function
-- rather than folded into stamp_booking_price_from_service (0009/0010) —
-- different timing and a single responsibility each.
--
-- ON CONFLICT (booking_id) DO NOTHING rides on chat_rooms_booking_id_key
-- (0001's UNIQUE on booking_id): one room per booking by construction, and
-- the trigger is idempotent if a room already exists (e.g. created manually
-- during testing).
--
-- SECURITY DEFINER + pinned search_path, matching the established hardening
-- shape (0009/0010/0012). RLS's chat_rooms_insert_participants would in fact
-- permit the booking customer's own trigger-context insert today, but this
-- guarantee should not depend on that policy never changing — defense in
-- depth, same rationale as 0009's price stamp.
-- ============================================================

create or replace function public.create_chat_room_for_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.chat_rooms (booking_id, customer_id, barber_id)
  values (new.id, new.customer_id, new.barber_id)
  on conflict (booking_id) do nothing;
  return new;
end;
$function$;

drop trigger if exists trg_create_chat_room_for_booking on public.bookings;
create trigger trg_create_chat_room_for_booking
  after insert on public.bookings
  for each row execute function public.create_chat_room_for_booking();

-- Trigger-only function, never callable via the PostgREST RPC surface;
-- revoking EXECUTE does not affect trigger firing (same as 0002/0005/0009).
revoke execute on function public.create_chat_room_for_booking() from public, anon, authenticated;

-- ============================================================
-- 2. Backfill — bookings created before this migration have no room.
-- Exactly the trigger's own insert, applied to every existing booking
-- (1 row at migration time: the 2026-07-09 on-device test booking).
-- ============================================================

insert into public.chat_rooms (booking_id, customer_id, barber_id)
select b.id, b.customer_id, b.barber_id
from public.bookings b
on conflict (booking_id) do nothing;

-- ============================================================
-- 3. Conversation-read index — the conversation screen's core query is
-- "messages in this room, ordered by created_at". The single-column
-- idx_messages_chat_id (0001) cannot serve the ORDER BY; the composite
-- makes the read an index-ordered range scan and fully covers every query
-- the old index served, so the old one is dropped rather than kept as a
-- redundant near-duplicate.
-- ============================================================

create index if not exists idx_messages_chat_id_created_at
  on public.messages (chat_id, created_at);

drop index if exists public.idx_messages_chat_id;
