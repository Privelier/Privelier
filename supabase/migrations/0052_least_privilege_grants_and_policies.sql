-- Least-privilege API surface (hardening 2026-10-26, Phase 2).
--
-- 1. anon: discovery and every other screen require sign-in (0006), so the
--    logged-out role keeps no table, sequence or function privilege at all.
-- 2. authenticated: writes are granted per column, matching exactly what the
--    two apps send. Protected columns (price, status on insert, role,
--    verified, verification_status, rating, reviewer fields, display
--    coordinates, timestamps) were already guarded by triggers; the grants
--    now refuse them before any trigger runs. TRUNCATE, TRIGGER and
--    REFERENCES are never needed by an API client.
-- 3. Policies: every policy targets `authenticated` instead of `public`, and
--    the three FOR ALL policies become one policy per command.
-- 4. chat_rooms are created only by trg_create_chat_room_for_booking
--    (SECURITY DEFINER); the client INSERT path is removed.
-- 5. Portfolio rows are readable only for the owner or an approved barber,
--    like services and availability.

-- 1. anon -------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
-- New functions are otherwise executable by PUBLIC (which includes anon);
-- every RPC grants authenticated explicitly instead.
alter default privileges in schema public revoke execute on functions from public;

-- 2. authenticated: no table-wide writes, then column grants -----------------
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from authenticated;
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from authenticated;

grant insert (id, email, name, role, city, country, phone) on public.users to authenticated;
grant update (name, city, country, phone, profile_image) on public.users to authenticated;

grant insert (user_id, bio) on public.barber_profile to authenticated;
grant update (bio) on public.barber_profile to authenticated;

grant insert (barber_id, name, price, duration_minutes) on public.services to authenticated;
grant update (name, price, duration_minutes) on public.services to authenticated;
grant delete on public.services to authenticated;

grant insert (barber_id, day_of_week, specific_date, start_time, end_time) on public.availability to authenticated;
grant update (day_of_week, specific_date, start_time, end_time) on public.availability to authenticated;
grant delete on public.availability to authenticated;

grant insert (barber_id, day) on public.barber_days_off to authenticated;
grant delete on public.barber_days_off to authenticated;

grant insert (customer_id, barber_id, service_id, date, time, location, location_latitude, location_longitude)
  on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;

-- An upsert's ON CONFLICT DO UPDATE writes every column it was sent.
grant insert (chat_id, user_id, last_read_at) on public.chat_read_state to authenticated;
grant update (chat_id, user_id, last_read_at) on public.chat_read_state to authenticated;

grant insert (id, chat_id, sender_id, message) on public.messages to authenticated;

grant insert (barber_id, image_url) on public.portfolio to authenticated;
grant delete on public.portfolio to authenticated;

grant insert (booking_id, customer_id, barber_id, rating, comment) on public.reviews to authenticated;

grant insert (user_id, id_image_url, license_image_url) on public.verification_requests to authenticated;
grant update (id_image_url, license_image_url) on public.verification_requests to authenticated;

grant insert (user_id, address, latitude, longitude, location_updated_at) on public.barber_location to authenticated;
grant update (user_id, address, latitude, longitude, location_updated_at) on public.barber_location to authenticated;

grant insert (customer_id, label, address) on public.customer_addresses to authenticated;
grant delete on public.customer_addresses to authenticated;

grant insert (customer_id, barber_id) on public.customer_favorites to authenticated;
grant delete on public.customer_favorites to authenticated;

grant update (read_at) on public.notifications to authenticated;

grant insert (blocker_id, blocked_id) on public.user_blocks to authenticated;
grant delete on public.user_blocks to authenticated;

grant insert (reporter_id, reported_id, reason, details, booking_id) on public.user_reports to authenticated;

grant insert (booking_id, user_id, kind, latitude, longitude) on public.safety_events to authenticated;

-- 3. Policies ----------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public' and roles = '{public}'
  loop
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
  end loop;
end
$$;

drop policy availability_write_own on public.availability;
create policy availability_insert_own on public.availability
  for insert to authenticated
  with check (barber_id = (select auth.uid()) and public.has_role('barber'));
create policy availability_update_own on public.availability
  for update to authenticated
  using (barber_id = (select auth.uid()))
  with check (barber_id = (select auth.uid()));
create policy availability_delete_own on public.availability
  for delete to authenticated
  using (barber_id = (select auth.uid()));

drop policy services_write_own on public.services;
create policy services_insert_own on public.services
  for insert to authenticated
  with check (barber_id = (select auth.uid()) and public.has_role('barber'));
create policy services_update_own on public.services
  for update to authenticated
  using (barber_id = (select auth.uid()))
  with check (barber_id = (select auth.uid()));
create policy services_delete_own on public.services
  for delete to authenticated
  using (barber_id = (select auth.uid()));

drop policy portfolio_write_own on public.portfolio;
create policy portfolio_insert_own on public.portfolio
  for insert to authenticated
  with check (barber_id = (select auth.uid()) and public.has_role('barber'));
create policy portfolio_delete_own on public.portfolio
  for delete to authenticated
  using (barber_id = (select auth.uid()));

-- 5. Portfolio visibility follows the approved-barber rule.
drop policy portfolio_select_all on public.portfolio;
create policy portfolio_select_own_or_approved on public.portfolio
  for select to authenticated
  using (
    barber_id = (select auth.uid())
    or exists (
      select 1 from public.barber_profile bp
      where bp.user_id = portfolio.barber_id
        and bp.verification_status = 'approved'
    )
  );

-- 4. Chat rooms come from the booking trigger only.
drop policy chat_rooms_insert_participants on public.chat_rooms;

-- Trigger functions are never called directly.
revoke execute on function public.enforce_booking_status_transition() from public, authenticated;
revoke execute on function public.enforce_portfolio_max_six() from public, authenticated;
revoke execute on function public.enforce_review_requires_completed_booking() from public, authenticated;
