-- Looks slice S2: the existing safety and notification systems learn about
-- looks (docs/genius/LOOKS_REVIEW.md section 4).
--
-- 1. Notifications: a new 'look_confirm' event tells the customer that the
--    barber captured the result of their appointment ("Is this your cut?").
--    It belongs to the look's booking, so the booking_id NOT NULL rule of
--    0035 still holds. The lock-screen copy names the barber only, never a
--    place or a photo. Raised by a trigger when the barber submits a look.
-- 2. Reports: a look can be reported (for example a recognizable face, or
--    a photo that is not this customer). The reporter must be able to see
--    the look: its customer, or anyone once it is published (feed, slice S3).
--    The report names the barber who captured it; the founders' report alert
--    (0061) fires automatically because it hangs on user_reports.
-- Rate limits live inside the look functions (0063); slice S2 stores no
-- free text, so the denylist (0056) has nothing new to screen yet.

-- ---------------------------------------------------------------------------
-- 1. Notifications
-- ---------------------------------------------------------------------------
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

-- Same copy as 0049 plus look_confirm. Mirrors notificationCopy() in
-- src/shared/notifications.ts.
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

create or replace function private.notify_look_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.submitted_at is null and new.submitted_at is not null then
    insert into public.notifications (recipient_id, event_type, booking_id, actor_id, event_key)
    values (new.customer_id, 'look_confirm', new.booking_id, new.barber_id, 'look:' || new.id::text || ':confirm')
    on conflict (event_key) do nothing;
  end if;
  return new;
end;
$function$;
revoke all on function private.notify_look_submitted() from public, anon, authenticated;

create trigger trg_notify_look_submitted
  after update of submitted_at on public.looks
  for each row execute function private.notify_look_submitted();

-- ---------------------------------------------------------------------------
-- 2. Reports
-- ---------------------------------------------------------------------------
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
     where conrelid = 'public.user_reports'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%target_type = ANY%'
  loop
    execute format('alter table public.user_reports drop constraint %I', v_name);
  end loop;
end;
$$;
alter table public.user_reports add constraint user_reports_target_type_check
  check (target_type in ('user', 'message', 'review', 'look'));

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
