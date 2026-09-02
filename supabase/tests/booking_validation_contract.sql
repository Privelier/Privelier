-- Focused migration contract checks. Run with the Supabase database test
-- runner after migrations are applied; these checks deliberately inspect the
-- database objects without creating customer or barber data.

begin;

do $$
declare
  column_is_snapshot boolean;
  has_validation_trigger boolean;
  has_duration_check boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'duration_minutes'
      and is_nullable = 'NO'
  ) into column_is_snapshot;

  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.bookings'::regclass
      and tgname = 'trg_validate_booking_slot'
      and not tgisinternal
  ) into has_validation_trigger;

  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'chk_bookings_duration_minutes'
  ) into has_duration_check;

  if not column_is_snapshot then
    raise exception 'duration_minutes snapshot is missing or nullable';
  end if;
  if not has_validation_trigger then
    raise exception 'booking validation trigger is missing';
  end if;
  if not has_duration_check then
    raise exception 'duration snapshot check is missing';
  end if;
end $$;

rollback;
