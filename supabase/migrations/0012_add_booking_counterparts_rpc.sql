-- Step 13-14 (barber requests & realtime status) — counterpart-identity RPC.
--
-- `users` RLS is own-row-only (0006), so a barber cannot read a booking
-- customer's name/photo (and vice versa) — request/booking cards otherwise
-- have to lead with the service name. This RPC closes that gap WITHOUT
-- widening `users` SELECT to all authenticated users: it exposes only the
-- OTHER participant's id, name, and profile_image, and only for bookings the
-- caller actually belongs to.
--
-- Same hardening shape as get_barber_busy_slots (0009): language sql, stable,
-- security definer, pinned search_path, execute revoked from public/anon and
-- granted only to authenticated.
--
-- CRITICAL anti-leak note: a SECURITY DEFINER function runs as the owner and
-- BYPASSES `users` RLS, so the participant predicate MUST live in the body.
-- The `where` clause self-scopes to bookings where the caller is a participant
-- (`b.customer_id = auth.uid() or b.barber_id = auth.uid()`), and the join
-- returns the COUNTERPART (the barber when the caller is the customer, else the
-- customer). Never exposes email/phone/city/country/role — only the three
-- display columns in the return signature.
create or replace function public.get_booking_counterparts(p_booking_ids uuid[])
returns table (booking_id uuid, id uuid, name text, profile_image text)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    b.id as booking_id,
    u.id,
    u.name,
    u.profile_image
  from public.bookings b
  join public.users u
    on u.id = case
                when b.customer_id = auth.uid() then b.barber_id
                else b.customer_id
              end
  where b.id = any(p_booking_ids)
    and (b.customer_id = auth.uid() or b.barber_id = auth.uid());
$function$;

-- Postgres grants EXECUTE to PUBLIC by default at creation; revoke it and
-- grant only to authenticated, mirroring get_barber_busy_slots (0009). anon
-- has no schema usage as of 0006, but this keeps the function-level grant
-- honest independent of that.
revoke execute on function public.get_booking_counterparts(uuid[]) from public, anon;
grant execute on function public.get_booking_counterparts(uuid[]) to authenticated;
