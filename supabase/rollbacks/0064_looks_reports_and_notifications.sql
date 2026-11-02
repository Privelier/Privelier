-- Rollback for 0064_looks_reports_and_notifications.sql. Apply before the
-- 0063 rollback.
--
-- Data handling: 'look_confirm' notifications are deleted (they point at
-- looks that the 0063 rollback removes). Look reports are KEPT as plain user
-- reports against the barber (target_type 'user'), with their snapshot text.

drop trigger if exists trg_notify_look_submitted on public.looks;
drop function if exists private.notify_look_submitted();

delete from public.notifications where event_type = 'look_confirm';
alter table public.notifications drop constraint notifications_event_type_check;
alter table public.notifications drop constraint notifications_message_shape;
alter table public.notifications add constraint notifications_event_type_check
  check (event_type in ('message', 'new_request', 'booking_status', 'trip_started', 'trip_arriving', 'trip_arrived'));
alter table public.notifications add constraint notifications_message_shape check (
  (event_type = 'message' and message_id is not null and booking_status is null)
  or (event_type in ('new_request', 'trip_started', 'trip_arriving', 'trip_arrived')
      and message_id is null and booking_status is null)
  or (event_type = 'booking_status' and message_id is null and booking_status is not null)
);

-- Restore the 0049 copy (identical minus look_confirm).
create or replace function public.notification_push_copy(
  p_event text,
  p_status public.booking_status_type,
  p_actor_name text,
  p_language text
)
returns table (title text, body text)
language sql
immutable
set search_path = public, pg_temp
as $function$
  select * from (values (
    case
      when p_language = 'de' then case p_event
        when 'message' then 'Neue Nachricht'
        when 'new_request' then 'Neue Terminanfrage'
        when 'trip_started' then 'Dein Barber ist unterwegs'
        when 'trip_arriving' then 'Gleich da'
        when 'trip_arrived' then 'Dein Barber ist da'
        else case p_status
          when 'accepted' then 'Termin bestätigt'
          when 'rejected' then 'Terminanfrage abgelehnt'
          when 'cancelled' then 'Termin abgesagt'
          when 'completed' then 'Termin abgeschlossen'
          else 'Termin aktualisiert' end
        end
      else case p_event
        when 'message' then 'New message'
        when 'new_request' then 'New booking request'
        when 'trip_started' then 'Your barber is on the way'
        when 'trip_arriving' then 'Almost there'
        when 'trip_arrived' then 'Your barber has arrived'
        else case p_status
          when 'accepted' then 'Booking accepted'
          when 'rejected' then 'Booking declined'
          when 'cancelled' then 'Booking cancelled'
          when 'completed' then 'Appointment complete'
          else 'Booking updated' end
        end
    end,
    case
      when p_language = 'de' then case p_event
        when 'message' then p_actor_name || ' hat dir eine Nachricht geschickt.'
        when 'new_request' then p_actor_name || ' hat einen Termin angefragt.'
        when 'trip_started' then p_actor_name || ' ist auf dem Weg zu dir. Verfolge die Ankunft live.'
        when 'trip_arriving' then p_actor_name || ' ist in wenigen Minuten bei dir.'
        when 'trip_arrived' then p_actor_name || ' ist an deiner Adresse angekommen.'
        else case p_status
          when 'accepted' then p_actor_name || ' hat den Termin bestätigt.'
          when 'rejected' then p_actor_name || ' hat den Termin abgelehnt.'
          when 'cancelled' then p_actor_name || ' hat den Termin abgesagt.'
          when 'completed' then p_actor_name || ' hat den Termin abgeschlossen.'
          else p_actor_name || ' hat den Termin aktualisiert.' end
        end
      else case p_event
        when 'message' then p_actor_name || ' sent you a message.'
        when 'new_request' then p_actor_name || ' requested an appointment.'
        when 'trip_started' then p_actor_name || ' is on the way to you. Follow the arrival live.'
        when 'trip_arriving' then p_actor_name || ' will be with you in a few minutes.'
        when 'trip_arrived' then p_actor_name || ' has arrived at your address.'
        else case p_status
          when 'accepted' then p_actor_name || ' accepted the appointment.'
          when 'rejected' then p_actor_name || ' declined the appointment.'
          when 'cancelled' then p_actor_name || ' cancelled the appointment.'
          when 'completed' then p_actor_name || ' marked the appointment complete.'
          else p_actor_name || ' updated the appointment.' end
        end
    end
  )) as copy (title, body);
$function$;
revoke all on function public.notification_push_copy(text, public.booking_status_type, text, text) from public, anon, authenticated;

-- Keep look reports as user reports against the barber.
update public.user_reports set target_type = 'user', target_id = null where target_type = 'look';
alter table public.user_reports drop constraint user_reports_target_type_check;
alter table public.user_reports add constraint user_reports_target_type_check
  check (target_type in ('user', 'message', 'review'));

-- Restore the 0056 resolver.
create or replace function private.resolve_report_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reporter uuid := new.reporter_id;
begin
  new.target_excerpt := null;
  if new.target_type = 'message' then
    select m.message, m.sender_id into new.target_excerpt, new.reported_id
    from public.messages m
    join public.chat_rooms cr on cr.id = m.chat_id
    where m.id = new.target_id
      and (cr.customer_id = v_reporter or cr.barber_id = v_reporter)
      and m.sender_id <> v_reporter;
    if not found then
      raise exception 'message not found' using errcode = 'P0002';
    end if;
  elsif new.target_type = 'review' then
    select r.comment, r.customer_id into new.target_excerpt, new.reported_id
    from public.reviews r
    where r.id = new.target_id and r.customer_id is distinct from v_reporter;
    if not found then
      raise exception 'review not found' using errcode = 'P0002';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.resolve_report_target() from public, anon, authenticated;
