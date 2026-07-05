-- Fix (architect-review finding, Stage 2 of the Step 9-10 customer-discovery
-- pipeline run): services_select_all and availability_select_all (0001:264-267,
-- 0001:277-280; scoped `to authenticated` by 0006 step E) both use
-- `using (true)` -- ANY authenticated caller can read ANY barber's services
-- and availability rows, including a barber whose barber_profile.
-- verification_status is still 'pending' (or 'rejected'). That defeats the
-- manual-verification gate: an unapproved barber's business data (service
-- names/prices/durations) and schedule (day-of-week/time patterns) would be
-- fully browsable by any logged-in user before that barber is vetted, with
-- only "the app happens to navigate here from an approved barber_directory
-- entry" as the (client-side, not DB-enforced) defense. This came up because
-- the not-yet-built barber-profile-page services fetch (build-order step
-- 9-10) needs a real SELECT policy, and app-layer navigation discipline is
-- not a substitute for a DB-level gate.
--
-- Fix: tighten both policies' USING clause to require EITHER the caller owns
-- the row (barber_id = auth.uid()) OR the row's owning barber is approved.
-- The owner branch is required, not optional: Step 7-8 already lets a barber
-- create/manage their own services and availability before being approved
-- (barber_write_own has no verification_status condition, by design -- a
-- barber must be able to build out their offering pre-approval), so that
-- same barber must still be able to SELECT their own not-yet-approved rows
-- back (e.g. to populate an edit screen) or Step 7-8 functionality regresses.
--
-- The approved-barber branch reuses, verbatim, the exact
-- `exists (select 1 from public.barber_profile bp where bp.user_id = ... and
-- bp.verification_status = 'approved'::verification_status_type)` pattern
-- migration 0004 already established for bookings_insert_customer
-- (0004:47-51) -- no new pattern invented here.
--
-- Scoped to exactly these two policies per CLAUDE.md's "one feature per
-- pipeline run" / "schema is sacred" rules -- no other table, policy, grant,
-- or column is touched.

-- ---- SERVICES ----

drop policy if exists "services_select_all" on public.services;
create policy "services_select_own_or_approved"
  on public.services for select
  to authenticated
  using (
    barber_id = auth.uid()
    or exists (
      select 1 from public.barber_profile bp
      where bp.user_id = services.barber_id
        and bp.verification_status = 'approved'::verification_status_type
    )
  );

-- ---- AVAILABILITY ----

drop policy if exists "availability_select_all" on public.availability;
create policy "availability_select_own_or_approved"
  on public.availability for select
  to authenticated
  using (
    barber_id = auth.uid()
    or exists (
      select 1 from public.barber_profile bp
      where bp.user_id = availability.barber_id
        and bp.verification_status = 'approved'::verification_status_type
    )
  );
