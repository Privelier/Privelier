-- Fix 1 (from retrospective database-optimizer review): RLS-predicate columns
-- with no supporting index. chat_rooms_select_participants filters directly
-- on customer_id/barber_id with no index behind either column (booking_id's
-- UNIQUE constraint doesn't cover this). reviews.customer_id has the same gap
-- its sibling column reviews.barber_id already has an index for.
create index if not exists idx_chat_rooms_customer_id on public.chat_rooms(customer_id);
create index if not exists idx_chat_rooms_barber_id on public.chat_rooms(barber_id);
create index if not exists idx_reviews_customer_id on public.reviews(customer_id);

-- Fix 2 (from retrospective architect-reviewer review): several write policies
-- only ever checked row ownership (e.g. barber_id = auth.uid()), never that
-- the caller's users.role actually matches. A customer-role account could
-- insert a services/availability/portfolio/barber_profile row for themselves,
-- or a customer could book a barber who isn't role='barber' and 'approved'.
create or replace function public.has_role(target_role user_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1 from public.users where id = auth.uid() and role = target_role
  );
$function$;

alter policy barber_profile_insert_own on public.barber_profile
with check (user_id = auth.uid() and public.has_role('barber'));

alter policy services_write_own on public.services
using (barber_id = auth.uid() and public.has_role('barber'))
with check (barber_id = auth.uid() and public.has_role('barber'));

alter policy availability_write_own on public.availability
using (barber_id = auth.uid() and public.has_role('barber'))
with check (barber_id = auth.uid() and public.has_role('barber'));

alter policy portfolio_write_own on public.portfolio
using (barber_id = auth.uid() and public.has_role('barber'))
with check (barber_id = auth.uid() and public.has_role('barber'));

alter policy bookings_insert_customer on public.bookings
with check (
  customer_id = auth.uid()
  and status = 'pending'::booking_status_type
  and public.has_role('customer')
  and exists (
    select 1 from public.barber_profile bp
    where bp.user_id = bookings.barber_id
      and bp.verification_status = 'approved'::verification_status_type
  )
);
