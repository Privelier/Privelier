-- Rollback for 0067_looks_wishes_and_offers.sql. Apply before the 0066
-- rollback.
--
-- Data handling: every wish, offer and wish notification is deleted
-- (bookings made from an offer stay as normal bookings, their look reference
-- stays). Wish and offer reports are KEPT as plain user reports against the
-- reported person, with their snapshot text. Reference photos of wishes stay
-- in the client's folder of `look-references` until the 0066 rollback.

drop trigger if exists trg_notify_look_wish on public.look_wishes;
drop trigger if exists trg_notify_look_offer on public.look_wish_offers;
drop function if exists private.notify_look_wish();
drop function if exists private.notify_look_offer();

drop function if exists public.create_wish(text, date, time, time, text);
drop function if exists public.cancel_wish(uuid);
drop function if exists public.wish_offers(uuid);
drop function if exists public.accept_offer(uuid, uuid);
drop function if exists public.open_wishes();
drop function if exists public.offer_for_wish(uuid, uuid, time, text);
drop function if exists public.withdraw_offer(uuid);

-- Notifications: back to the 0064 shape, booking required again.
delete from public.notifications where event_type in ('look_wish', 'look_offer');
alter table public.notifications drop constraint if exists notifications_subject;
alter table public.notifications drop constraint notifications_event_type_check;
alter table public.notifications drop constraint notifications_message_shape;
alter table public.notifications add constraint notifications_event_type_check
  check (event_type in ('message', 'new_request', 'booking_status', 'trip_started', 'trip_arriving', 'trip_arrived', 'look_confirm'));
alter table public.notifications add constraint notifications_message_shape check (
  (event_type = 'message' and message_id is not null and booking_status is null)
  or (event_type in ('new_request', 'trip_started', 'trip_arriving', 'trip_arrived', 'look_confirm')
      and message_id is null and booking_status is null)
  or (event_type = 'booking_status' and message_id is null and booking_status is not null)
);
alter table public.notifications alter column booking_id set not null;
drop index if exists public.notifications_look_wish_idx;
alter table public.notifications drop column if exists look_wish_id;

-- Restore the 0064 copy (identical minus look_wish and look_offer).
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
        when 'look_confirm' then 'Ist das dein Schnitt?'
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
        when 'look_confirm' then 'Is this your cut?'
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
        when 'look_confirm' then p_actor_name || ' hat das Ergebnis deines Termins festgehalten. Bestätige es oder lehne ab.'
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
        when 'look_confirm' then p_actor_name || ' captured the result of your appointment. Confirm it or decline.'
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

-- Reports: keep wish and offer reports as user reports.
update public.user_reports set target_type = 'user', target_id = null where target_type in ('wish', 'offer');
alter table public.user_reports drop constraint user_reports_target_type_check;
alter table public.user_reports add constraint user_reports_target_type_check
  check (target_type in ('user', 'message', 'review', 'look'));

-- Restore the 0064 resolver.
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
  elsif new.target_type = 'look' then
    select 'look ' || l.id::text || ' [' || array_to_string(l.styles, ', ') || '] status ' || l.status,
           l.barber_id
      into new.target_excerpt, new.reported_id
    from public.looks l
    where l.id = new.target_id
      and l.barber_id <> v_reporter
      and ((l.customer_id = v_reporter and l.submitted_at is not null) or l.status = 'published');
    if not found then
      raise exception 'look not found' using errcode = 'P0002';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.resolve_report_target() from public, anon, authenticated;

-- Restore the 0066 reference photo rule (booked barber only).
create or replace function private.can_view_reference_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.flag_enabled('looks') and exists (
    select 1
    from public.look_references r
    join public.bookings b on b.id = r.booking_id
    where r.photo_path = p_name
      and b.barber_id = (select auth.uid())
      and b.status in ('pending', 'accepted')
  );
$function$;

-- barber_can_offer takes the wish row type, so it goes before the table.
drop function if exists private.barber_can_offer(uuid, public.look_wishes);
drop table if exists public.look_wish_offers;
drop table if exists public.look_wishes;
drop function if exists private.barber_slot_free(uuid, date, time, integer);
drop function if exists private.flag_enabled_for(text, uuid);

alter table private.looks_settings
  drop column if exists wish_valid_hours,
  drop column if exists max_open_wishes,
  drop column if exists wish_notify_barbers;
