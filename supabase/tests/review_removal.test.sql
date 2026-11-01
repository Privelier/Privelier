-- Founder removal of a review (migration 0070): the barber's rating follows
-- the deletion, and clients still cannot delete. Synthetic users only; the
-- transaction never commits.
--
-- Run: python tools/db/supa.py test supabase/tests/review_removal.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

alter table public.bookings disable trigger trg_validate_booking_slot;
insert into public.bookings (customer_id, barber_id, service_id, date, time, location, status)
values (tests.id('b'), tests.id('x'), tests.id('svc_x'), current_date - 6, '10:00', 'Somewhere 2', 'completed');
alter table public.bookings enable trigger trg_validate_booking_slot;
insert into fx select 'done_b', id::text from public.bookings where customer_id = tests.id('b') and status = 'completed';

select is(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 5)$$,
  tests.id('done'), tests.id('a'), tests.id('x'))), 'ok', 'setup: a five-star review');
select is(tests.run(tests.id('b'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating, comment) values (%L, %L, %L, 1, 'Rule-breaking text')$$,
  tests.id('done_b'), tests.id('b'), tests.id('x'))), 'ok', 'setup: a one-star review');
select is((select rating from public.barber_profile where user_id = tests.id('x')), 3.00::numeric, 'the average covers both reviews');

select is(tests.run(tests.id('b'), format($$delete from public.reviews where booking_id = %L$$, tests.id('done_b'))), '42501',
  'the author still cannot delete a review');

delete from public.reviews where booking_id = tests.id('done_b');
select is((select rating from public.barber_profile where user_id = tests.id('x')), 5.00::numeric,
  'a founder removal recomputes the average');

delete from public.reviews where booking_id = tests.id('done');
select is((select rating from public.barber_profile where user_id = tests.id('x')), 0.00::numeric,
  'removing the last review resets the average');

select * from finish();
rollback;
