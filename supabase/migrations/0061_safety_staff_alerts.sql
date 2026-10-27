-- Safety and reports process (founder decision F18, 2026-10-27): both
-- founders read every user report and every SOS within 24 hours (SOS at
-- once), and act by warning, suspending, then removing. This migration makes
-- sure they hear about each one:
--
-- 1. private.safety_staff lists the accounts that review reports. Founders
--    add themselves once in the SQL editor:
--      insert into private.safety_staff (user_id)
--      select id from auth.users where email = '<founder email>';
-- 2. A new user report, or an SOS (not a trip share), pushes a short alert to
--    every staff device through the same Expo push path as 0049. The lock
--    screen copy names no person, place or report text; the details stay in
--    public.user_reports / public.safety_events, read in the dashboard.

create table if not exists private.safety_staff (
  user_id uuid primary key references public.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
revoke all on private.safety_staff from public, anon, authenticated;

create or replace function private.alert_safety_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_is_sos boolean := tg_table_name = 'safety_events';
  v_messages jsonb;
begin
  -- Nested so user_reports rows (no kind column) never evaluate new.kind.
  if v_is_sos then
    if new.kind <> 'sos' then
      return new;
    end if;
  end if;

  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', case
             when v_is_sos and t.language = 'de' then 'Sicherheitsalarm: SOS'
             when v_is_sos then 'Safety alert: SOS'
             when t.language = 'de' then 'Neue Meldung'
             else 'New report' end,
           'body', case
             when v_is_sos and t.language = 'de' then 'Jemand hat während eines Termins SOS ausgelöst. Jetzt prüfen.'
             when v_is_sos then 'Someone pressed SOS during an appointment. Check now.'
             when t.language = 'de' then 'Eine neue Meldung wartet auf Prüfung (innerhalb von 24 Stunden).'
             else 'A new report is waiting for review (within 24 hours).' end,
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default',
           'data', jsonb_build_object()
         ))
    into v_messages
    from private.safety_staff s
    join public.push_tokens t on t.user_id = s.user_id;

  if v_messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
exception when others then
  -- Best effort: the report or safety row is already stored either way.
  raise warning 'safety staff alert skipped: %', sqlerrm;
  return new;
end;
$function$;
revoke all on function private.alert_safety_staff() from public, anon, authenticated;

drop trigger if exists trg_alert_safety_staff on public.user_reports;
create trigger trg_alert_safety_staff
  after insert on public.user_reports
  for each row execute function private.alert_safety_staff();

drop trigger if exists trg_alert_safety_staff on public.safety_events;
create trigger trg_alert_safety_staff
  after insert on public.safety_events
  for each row execute function private.alert_safety_staff();
