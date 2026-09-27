-- Reviews are displayed newest first in customer barber profiles. This column
-- was already part of the client row type and query, but missing from the live
-- table. The live reviews table is empty, so no historical review times need
-- to be inferred.
alter table public.reviews
  add column if not exists created_at timestamptz not null default now();

create index if not exists reviews_barber_created_at_id_idx
  on public.reviews (barber_id, created_at desc, id desc);
