-- Restore the customer, booking, and barber relationship checks missing from
-- the live reviews policy. A customer may review only a completed booking
-- they own and the barber who actually handled it.
drop policy if exists reviews_insert_own_customer on public.reviews;

create policy reviews_insert_own_customer
  on public.reviews for insert
  to authenticated
  with check (
    customer_id = (select auth.uid())
    and public.has_role('customer')
    and exists (
      select 1
      from public.bookings b
      where b.id = reviews.booking_id
        and b.customer_id = reviews.customer_id
        and b.barber_id = reviews.barber_id
        and b.status = 'completed'
    )
  );
