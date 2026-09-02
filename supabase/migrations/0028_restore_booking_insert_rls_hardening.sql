-- Reconcile the live booking INSERT policy with the repository's intended RLS
-- contract from migration 0004. This does not add a policy or broaden access;
-- it restores customer-role and approved-barber checks.
alter policy bookings_insert_customer on public.bookings
with check (
  customer_id = auth.uid()
  and status = 'pending'::booking_status_type
  and public.has_role('customer')
  and exists (
    select 1
    from public.barber_profile bp
    where bp.user_id = bookings.barber_id
      and bp.verification_status = 'approved'::verification_status_type
  )
);
