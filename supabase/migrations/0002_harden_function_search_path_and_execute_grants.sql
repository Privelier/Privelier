-- Pin search_path on SECURITY DEFINER / trigger functions flagged by the security advisor
-- (mutable search_path is a known privilege-escalation vector).
alter function public.enforce_booking_status_transition() set search_path = public, pg_temp;
alter function public.enforce_portfolio_max_six() set search_path = public, pg_temp;
alter function public.enforce_review_requires_completed_booking() set search_path = public, pg_temp;
alter function public.protect_barber_verification_fields() set search_path = public, pg_temp;

-- These are trigger / event-trigger functions only, never meant to be called
-- directly via the PostgREST RPC endpoint (e.g. /rest/v1/rpc/rls_auto_enable).
-- Revoking EXECUTE does not affect trigger firing (Postgres invokes trigger
-- functions independent of the calling role's EXECUTE privilege on them).
revoke execute on function public.protect_barber_verification_fields() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- NOTE: is_admin() is intentionally left executable by anon/authenticated.
-- It's referenced inside the `public`-role RLS policies on users and
-- barber_profile (city-based barber discovery for logged-out browsing), so
-- revoking it would break anonymous browsing, not just an API endpoint.
-- If browsing should require login, that's a product/RLS decision to make
-- deliberately (tighten policy roles to `authenticated`), not a silent
-- side effect of a security patch.
