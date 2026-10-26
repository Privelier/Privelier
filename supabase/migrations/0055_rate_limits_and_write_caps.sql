-- Rate limits and hard caps on every user-reachable write
-- (hardening 2026-10-26, Phase 4).
--
-- The Supabase Data API has no built-in rate limit, so anyone holding the
-- publishable key can flood writes. Three layers:
--   1. private.consume_rate(): fixed-window counters in a private table,
--      used by triggers (messages, reports, blocks, safety events) and by
--      the request-level limiter. Limits raise SQLSTATE PA429.
--   2. private.limit_api_writes(): PostgREST db-pre-request hook. Counts
--      every non-read request per user and per hashed client IP and answers
--      HTTP 429 above the threshold. Reads cannot be counted there (they run
--      read-only); statement timeouts and bounded RPCs protect them.
--   3. Hard caps on row counts that only grow (services, availability, days
--      off, favorites, storage objects), plus the portfolio cap made safe
--      under concurrent inserts.
-- Roll back the request hook alone with:
--   alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';

create table private.rate_counter (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
alter table private.rate_counter enable row level security;
revoke all on private.rate_counter from public, anon, authenticated;

create or replace function private.consume_rate(p_bucket text, p_limit integer, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into private.rate_counter as c (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = c.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'Too many requests, please wait a moment'
      using errcode = 'PA429', hint = 'retry_after=' || p_window_seconds;
  end if;

  if random() < 0.01 then
    delete from private.rate_counter where window_start < now() - interval '2 hours';
  end if;
end;
$function$;
revoke all on function private.consume_rate(text, integer, integer) from public, anon, authenticated;

-- 1. Business-rule limits --------------------------------------------------
create or replace function private.limit_message_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.consume_rate('msg:' || new.sender_id || ':' || new.chat_id, 20, 60);
  return new;
end;
$function$;

create or replace function private.limit_report_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.consume_rate('report:' || new.reporter_id, 10, 3600);
  return new;
end;
$function$;

create or replace function private.limit_block_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.consume_rate('block:' || new.blocker_id, 30, 3600);
  return new;
end;
$function$;

create or replace function private.limit_safety_event_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.consume_rate('safety:' || new.user_id, 30, 3600);
  return new;
end;
$function$;

revoke all on function private.limit_message_rate() from public, anon, authenticated;
revoke all on function private.limit_report_rate() from public, anon, authenticated;
revoke all on function private.limit_block_rate() from public, anon, authenticated;
revoke all on function private.limit_safety_event_rate() from public, anon, authenticated;

create trigger trg_limit_message_rate before insert on public.messages
  for each row execute function private.limit_message_rate();
create trigger trg_limit_report_rate before insert on public.user_reports
  for each row execute function private.limit_report_rate();
create trigger trg_limit_block_rate before insert on public.user_blocks
  for each row execute function private.limit_block_rate();
create trigger trg_limit_safety_event_rate before insert on public.safety_events
  for each row execute function private.limit_safety_event_rate();

-- 3. Hard caps on growing rows ----------------------------------------------
create or replace function private.enforce_row_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_column text := tg_argv[0];
  v_cap integer := tg_argv[1]::integer;
  v_owner uuid;
  v_count integer;
begin
  execute format('select ($1).%I', v_owner_column) into v_owner using new;
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || v_owner, 0));
  execute format('select count(*) from public.%I where %I = $1', tg_table_name, v_owner_column)
    into v_count using v_owner;
  if v_count >= v_cap then
    raise exception 'Limit reached for %', tg_table_name using errcode = 'PA002';
  end if;
  return new;
end;
$function$;
revoke all on function private.enforce_row_cap() from public, anon, authenticated;

create trigger trg_cap_services before insert on public.services
  for each row execute function private.enforce_row_cap('barber_id', '30');
create trigger trg_cap_availability before insert on public.availability
  for each row execute function private.enforce_row_cap('barber_id', '60');
create trigger trg_cap_barber_days_off before insert on public.barber_days_off
  for each row execute function private.enforce_row_cap('barber_id', '400');
create trigger trg_cap_customer_favorites before insert on public.customer_favorites
  for each row execute function private.enforce_row_cap('customer_id', '200');

-- The six-photo cap counted without a lock, so two concurrent uploads at
-- five photos could both pass.
create or replace function public.enforce_portfolio_max_six()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('portfolio:' || new.barber_id, 0));
  if (select count(*) from public.portfolio where barber_id = new.barber_id) >= 6 then
    raise exception 'A barber may not have more than 6 portfolio images';
  end if;
  return new;
end;
$function$;
revoke execute on function public.enforce_portfolio_max_six() from public, authenticated;

-- Storage: bound the number of objects a user can park in each bucket.
create or replace function private.storage_object_count(p_bucket text, p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select count(*)::integer
  from storage.objects o
  where o.bucket_id = p_bucket
    and (storage.foldername(o.name))[1] = p_owner::text;
$function$;
revoke all on function private.storage_object_count(text, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.storage_object_count(text, uuid) to authenticated;

alter policy portfolio_insert_own on storage.objects
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('barber')
    and private.storage_object_count('portfolio', (select auth.uid())) < 12
  );
alter policy verification_docs_insert_own on storage.objects
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('barber')
    and private.storage_object_count('verification-docs', (select auth.uid())) < 10
  );

-- Bounded RPC inputs: at most one page of ids per call.
create or replace function public.get_booking_counterparts(p_booking_ids uuid[])
returns table(booking_id uuid, id uuid, name text, profile_image text)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select b.id as booking_id, u.id, u.name, u.profile_image
  from public.bookings b
  join public.users u
    on u.id = case when b.customer_id = (select auth.uid()) then b.barber_id else b.customer_id end
  where b.id = any(p_booking_ids[1:200])
    and (b.customer_id = (select auth.uid()) or b.barber_id = (select auth.uid()));
$function$;

create or replace function public.get_review_authors(p_review_ids uuid[])
returns table(review_id uuid, first_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select r.id as review_id, split_part(u.name, ' ', 1) as first_name
  from public.reviews r
  join public.users u on u.id = r.customer_id
  where r.id = any(p_review_ids[1:200]);
$function$;

-- 2. Request-level write limiter ---------------------------------------------
create or replace function private.limit_api_writes()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_ip text := btrim(split_part(
    coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
begin
  if coalesce(current_setting('request.method', true), 'GET') in ('GET', 'HEAD', 'OPTIONS')
     or current_setting('transaction_read_only') = 'on' then
    return;
  end if;
  begin
    if v_uid is not null then
      perform private.consume_rate('api:u:' || v_uid, 120, 60);
    end if;
    if v_ip <> '' then
      perform private.consume_rate('api:ip:' || md5(v_ip), 600, 60);
    end if;
  exception when sqlstate 'PA429' then
    raise sqlstate 'PGRST' using
      message = '{"code":"PA429","message":"Too many requests, please wait a moment"}',
      detail = '{"status":429,"headers":{"Retry-After":"60"}}';
  end;
end;
$function$;

revoke all on function private.limit_api_writes() from public;
grant usage on schema private to anon;
grant execute on function private.limit_api_writes() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request = 'private.limit_api_writes';
notify pgrst, 'reload config';
