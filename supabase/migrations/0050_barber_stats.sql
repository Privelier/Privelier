-- Barber stats for trust/planning UI (founder request by Ali, 2026-10-25:
-- intelligent, Python-automated UX components).
--
-- One row per barber, computed NIGHTLY by tools/automation/compute_barber_stats.py
-- (GitHub Actions, service_role) — never by the apps. Powers:
--   * "Usually replies in ~15 min" (median minutes from request to the
--     barber's accept/decline, only shown with >= 3 samples);
--   * "Popular times" (7 x 24 relative demand, 0..1, smoothed and shrunk
--     toward the marketplace-wide pattern so a barber with few bookings
--     never shows a misleading spike);
--   * the barber's own dashboard insight (busiest window, repeat clients).
--
-- Privacy: aggregates only — no customer ids, no individual bookings, no
-- timestamps of single appointments. Readable by signed-in users for
-- APPROVED barbers (the same audience as barber_directory), and by the
-- barber for their own row. No client write path at all.

create table if not exists public.barber_stats (
  barber_id uuid primary key references public.users(id) on delete cascade,
  median_response_minutes integer check (median_response_minutes is null or median_response_minutes >= 0),
  response_samples integer not null default 0 check (response_samples >= 0),
  popular_hours jsonb check (
    popular_hours is null
    or (jsonb_typeof(popular_hours) = 'array' and jsonb_array_length(popular_hours) = 7)
  ),
  popular_samples integer not null default 0 check (popular_samples >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  repeat_client_rate real check (repeat_client_rate is null or repeat_client_rate between 0 and 1),
  computed_at timestamptz not null default now()
);

alter table public.barber_stats enable row level security;
revoke all on public.barber_stats from public, anon, authenticated;
grant select on public.barber_stats to authenticated;
grant all on public.barber_stats to service_role;

drop policy if exists barber_stats_select_approved_or_own on public.barber_stats;
create policy barber_stats_select_approved_or_own
  on public.barber_stats for select to authenticated
  using (
    barber_id = (select auth.uid())
    or exists (
      select 1 from public.barber_profile bp
       where bp.user_id = barber_stats.barber_id
         and bp.verification_status = 'approved'::public.verification_status_type
    )
  );
