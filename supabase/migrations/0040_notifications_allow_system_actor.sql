-- Booking status changes made without a user JWT (service_role jobs, a future
-- admin path) failed: create_booking_notification() wrote auth.uid() (NULL)
-- into notifications.actor_id, which is NOT NULL, rolling back the status
-- update itself (audit F-02, reproduced live 2026-10-11).
--
-- Forward-only and additive: actor_id becomes nullable ("system"), and a
-- system-made status change notifies BOTH participants. User-made changes
-- keep exactly the previous behavior (notify the other participant, actor =
-- auth.uid()). No policy, grant, or booking rule changes.

alter table public.notifications alter column actor_id drop not null;

create or replace function public.create_booking_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.notifications
      (recipient_id, event_type, booking_id, actor_id, booking_status, event_key)
    values
      (new.barber_id, 'new_request', new.id, new.customer_id, null,
       'booking:' || new.id::text || ':new_request')
    on conflict (event_key) do nothing;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  foreach v_recipient in array
    case
      when v_actor is null then array[new.customer_id, new.barber_id]
      when v_actor = new.barber_id then array[new.customer_id]
      else array[new.barber_id]
    end
  loop
    insert into public.notifications
      (recipient_id, event_type, booking_id, actor_id, booking_status, event_key)
    values
      (v_recipient, 'booking_status', new.id, v_actor, new.status,
       'booking:' || new.id::text || ':' || new.status::text || ':' || v_recipient::text)
    on conflict (event_key) do nothing;
  end loop;
  return new;
end;
$$;

revoke all on function public.create_booking_notification() from public, anon, authenticated;
