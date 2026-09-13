-- Security hardening follow-up for the 2026-09-12 audit.
-- Forward-only: do not edit an applied migration.

-- SEC-001: anonymous callers must not enumerate service or availability rows.
drop policy if exists services_select_all on public.services;
drop policy if exists availability_select_all on public.availability;
drop policy if exists services_select_own_or_approved on public.services;
drop policy if exists availability_select_own_or_approved on public.availability;

create policy services_select_own_or_approved
  on public.services for select
  to authenticated
  using (
    barber_id = (select auth.uid())
    or exists (
      select 1
      from public.barber_profile bp
      where bp.user_id = services.barber_id
        and bp.verification_status = 'approved'::public.verification_status_type
    )
  );

create policy availability_select_own_or_approved
  on public.availability for select
  to authenticated
  using (
    barber_id = (select auth.uid())
    or exists (
      select 1
      from public.barber_profile bp
      where bp.user_id = availability.barber_id
        and bp.verification_status = 'approved'::public.verification_status_type
    )
  );

revoke select on table public.services, public.availability from anon;

-- SEC-002: the directory must evaluate under the querying user's RLS context.
alter view public.barber_directory set (security_invoker = true);

-- SEC-004: pin trigger search paths explicitly. Qualifying public objects in
-- the function bodies is handled by their existing definitions; this closes
-- the mutable-search-path privilege-escalation class.
alter function public.protect_barber_verification_fields() set search_path = public, pg_temp;
alter function public.enforce_portfolio_max_six() set search_path = public, pg_temp;
alter function public.enforce_review_requires_completed_booking() set search_path = public, pg_temp;

-- SEC-005: enforce server-side upload bounds for both image buckets.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id in ('portfolio', 'verification-docs');

-- Advisor performance follow-up: cover the remaining foreign keys without
-- changing application semantics or disabling RLS.
create index if not exists idx_bookings_service_id on public.bookings(service_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_verification_requests_reviewed_by
  on public.verification_requests(reviewed_by);
create index if not exists idx_waitlist_user_id on public.waitlist(user_id);

-- SEC-003 is intentionally retained: these narrow SECURITY DEFINER functions
-- are either shipped RPCs or invoked by RLS policies. Their authenticated
-- EXECUTE grants are required; each function has a pinned search_path and
-- returns only its documented projection. Revoke would break the product's
-- authorization path, so this advisor warning remains a documented design
-- exception rather than a false security fix.
