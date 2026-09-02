-- Split the availability index so both validation branches can use their
-- selective predicate columns after barber_id.
drop index if exists public.idx_availability_barber_date_window;

create index if not exists idx_availability_barber_specific_date
  on public.availability (barber_id, specific_date, start_time, end_time)
  where specific_date is not null;

create index if not exists idx_availability_barber_weekday
  on public.availability (barber_id, day_of_week, start_time, end_time)
  where day_of_week is not null;
