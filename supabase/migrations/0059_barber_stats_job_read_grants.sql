-- The nightly barber_stats job (tools/automation/compute_barber_stats.py,
-- GitHub Actions) reads with the project's secret key, i.e. as service_role.
-- service_role holds no SELECT on these tables in this project, so the job
-- could write barber_stats (0050) but not read its inputs. Grant exactly the
-- columns it selects or filters on, nothing else (least privilege, 0052).

grant select (user_id) on public.barber_profile to service_role;

grant select (id, barber_id, customer_id, date, time, status, created_at)
  on public.bookings to service_role;

grant select (booking_id, actor_id, created_at, event_type, booking_status)
  on public.notifications to service_role;
