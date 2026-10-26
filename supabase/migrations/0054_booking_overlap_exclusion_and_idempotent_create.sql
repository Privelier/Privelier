-- Booking integrity (hardening 2026-10-26, Phase 3).
--
-- 1. Overlaps: trg_validate_booking_slot rejects an overlapping request, but
--    as a read-then-insert check it cannot see a concurrent transaction's
--    uncommitted row. An exclusion constraint over the appointment's
--    half-open [start, end) range makes overlapping pending/accepted
--    bookings for one barber impossible regardless of timing. The range is
--    a tsrange because bookings store the barber's local wall-clock date and
--    time without a zone; both sides of any comparison share that zone.
--    The old same-start unique index is strictly weaker and is dropped.
-- 2. Idempotency: create_booking() takes a client-generated key, unique per
--    customer, so a double tap or a retry after a lost response returns the
--    first booking instead of creating a second one.
-- 3. Price and duration always come from the service row (the stamp
--    trigger); the client has no INSERT privilege on either column (0052).
-- 4. Positive prices: no free services exist and none is offered.

create extension if not exists btree_gist with schema extensions;

alter table public.bookings
  add column slot tsrange generated always as (
    tsrange(date + time, date + time + make_interval(mins => duration_minutes), '[)')
  ) stored;

alter table public.bookings
  add constraint bookings_no_overlapping_active_slot
  exclude using gist (barber_id with =, slot with &&)
  where (status in ('pending', 'accepted'));

drop index if exists public.uq_bookings_barber_slot_active;

alter table public.bookings add column idempotency_key uuid;
create unique index bookings_customer_idempotency_key_idx
  on public.bookings (customer_id, idempotency_key)
  where idempotency_key is not null;

alter table public.services drop constraint services_price_check;
alter table public.services add constraint services_price_check check (price > 0);
alter table public.bookings drop constraint bookings_price_check;
alter table public.bookings add constraint bookings_price_check check (price > 0);

create or replace function public.create_booking(
  p_service_id uuid,
  p_date date,
  p_time time,
  p_location text,
  p_idempotency_key uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_customer uuid := (select auth.uid());
  v_barber uuid;
  v_row public.bookings;
  v_constraint text;
begin
  if v_customer is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key required' using errcode = '22004';
  end if;

  select b.* into v_row
  from public.bookings b
  where b.customer_id = v_customer and b.idempotency_key = p_idempotency_key;
  if found then
    return v_row;
  end if;

  -- RLS: only own services or an approved barber's services are visible.
  select s.barber_id into v_barber from public.services s where s.id = p_service_id;
  if v_barber is null then
    raise exception 'service not found' using errcode = 'P0002';
  end if;

  begin
    insert into public.bookings (
      customer_id, barber_id, service_id, date, time, location,
      location_latitude, location_longitude, idempotency_key
    )
    values (
      v_customer, v_barber, p_service_id, p_date, p_time, btrim(p_location),
      p_latitude, p_longitude, p_idempotency_key
    )
    returning * into v_row;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'bookings_customer_idempotency_key_idx' then
      raise;
    end if;
    -- A concurrent call with the same key won the race.
    select b.* into v_row
    from public.bookings b
    where b.customer_id = v_customer and b.idempotency_key = p_idempotency_key;
  end;
  return v_row;
end;
$function$;

revoke all on function public.create_booking(uuid, date, time, text, uuid, double precision, double precision) from public, anon;
grant execute on function public.create_booking(uuid, date, time, text, uuid, double precision, double precision) to authenticated;
grant insert (idempotency_key) on public.bookings to authenticated;
