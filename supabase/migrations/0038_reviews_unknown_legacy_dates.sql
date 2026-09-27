-- Migration 0036 added created_at with a default, which assigns the migration
-- time to pre-existing reviews. That is not their real submission time. Keep
-- the current migration backfill nullable and clear only that exact synthetic
-- timestamp; future inserts continue receiving now() from the column default.
alter table public.reviews
  alter column created_at drop not null;

update public.reviews
set created_at = null
where created_at = timestamptz '2026-09-27 10:05:08.580984+00';
