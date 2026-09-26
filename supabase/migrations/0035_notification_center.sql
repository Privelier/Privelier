-- Durable in-app notification feed for both customer and barber apps.
-- Rows are created only by trusted database triggers; users can read and
-- mark their own rows as read, but cannot forge or delete notifications.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in ('message', 'new_request', 'booking_status')),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  booking_status public.booking_status_type,
  event_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_message_shape check (
    (event_type = 'message' and message_id is not null and booking_status is null)
    or (event_type = 'new_request' and message_id is null and booking_status is null)
    or (event_type = 'booking_status' and message_id is null and booking_status is not null)
  )
);

create index notifications_recipient_recent_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_mark_own_read
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.create_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient uuid;
  v_booking_id uuid;
begin
  select case when cr.customer_id = new.sender_id then cr.barber_id else cr.customer_id end,
         cr.booking_id
    into v_recipient, v_booking_id
    from public.chat_rooms cr
   where cr.id = new.chat_id
     and new.sender_id in (cr.customer_id, cr.barber_id);
  if v_recipient is null then return new; end if;

  insert into public.notifications
    (recipient_id, event_type, booking_id, message_id, actor_id, event_key)
  values
    (v_recipient, 'message', v_booking_id, new.id, new.sender_id,
     'message:' || new.id::text || ':' || v_recipient::text)
  on conflict (event_key) do nothing;
  return new;
end;
$$;

create trigger messages_create_notification
  after insert on public.messages
  for each row execute function public.create_message_notification();
revoke all on function public.create_message_notification() from public, anon, authenticated;

create or replace function public.create_booking_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recipient uuid;
  v_type text;
  v_event_key text;
begin
  if tg_op = 'INSERT' then
    v_recipient := new.barber_id;
    v_type := 'new_request';
    v_event_key := 'booking:' || new.id::text || ':new_request';
  elsif new.status is distinct from old.status then
    v_recipient := case when auth.uid() = new.barber_id then new.customer_id else new.barber_id end;
    v_type := 'booking_status';
    v_event_key := 'booking:' || new.id::text || ':' || new.status::text || ':' || v_recipient::text;
  else
    return new;
  end if;

  insert into public.notifications
    (recipient_id, event_type, booking_id, actor_id, booking_status, event_key)
  values
    (v_recipient, v_type, new.id,
     case when tg_op = 'INSERT' then new.customer_id else auth.uid() end,
     case when v_type = 'booking_status' then new.status else null end,
     v_event_key)
  on conflict (event_key) do nothing;
  return new;
end;
$$;

create trigger bookings_create_notification_insert
  after insert on public.bookings
  for each row execute function public.create_booking_notification();
create trigger bookings_create_notification_status
  after update of status on public.bookings
  for each row execute function public.create_booking_notification();
revoke all on function public.create_booking_notification() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
