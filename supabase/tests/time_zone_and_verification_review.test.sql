-- Barber time zone, pending-cap expiry and the verification review path
-- (0069). The transaction never commits.
--
-- Run: python tools/db/supa.py test supabase/tests/time_zone_and_verification_review.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

-- The error text a statement raised as an actor, or 'ok'.
create function tests.error_text(p_actor uuid, p_sql text) returns text language plpgsql as $$
begin
  perform tests.become(p_actor);
  execute p_sql;
  perform tests.reset();
  return 'ok';
exception when others then
  perform tests.reset();
  return sqlerrm;
end $$;
grant execute on function tests.error_text(uuid, text) to anon, authenticated;

-- 1. Time zone ---------------------------------------------------------------

select is((select time_zone from public.users where id = tests.id('a')), 'Europe/Berlin', 'new accounts default to Europe/Berlin');
select is(tests.run(tests.id('a'), format($$update public.users set time_zone = 'America/New_York' where id = %L$$, tests.id('a'))), 'ok', 'a user can set their own time zone');
select is(tests.run(tests.id('a'), format($$update public.users set time_zone = 'Mars/Olympus' where id = %L$$, tests.id('a'))), '22023', 'an unknown time zone is refused');
select is(tests.affected(tests.id('b'), format($$update public.users set time_zone = 'Asia/Tokyo' where id = %L$$, tests.id('a'))), 0, 'nobody can set another user''s time zone');

-- A slot two hours ahead in UTC is already in the past for a barber at UTC+14.
insert into fx select 'slot', (date_trunc('hour', now() at time zone 'UTC') + interval '2 hours')::text;
insert into public.availability (barber_id, specific_date, start_time, end_time)
values (tests.id('x'), (select v::timestamp::date from fx where k = 'slot'), '00:00', '23:59:59');

update public.users set time_zone = 'Etc/GMT-14' where id = tests.id('x');
select is(tests.error_text(tests.id('a'), format(
  $$select public.create_booking(%L, %L::date, %L::time, 'Street 1', gen_random_uuid())$$,
  tests.id('svc_x'), (select v::timestamp::date from fx where k = 'slot'), (select v::timestamp::time from fx where k = 'slot'))),
  'Booking date and time must be in the future', 'the future check uses the barber''s local time');

update public.users set time_zone = 'Etc/GMT+12' where id = tests.id('x');
select isnt(tests.error_text(tests.id('a'), format(
  $$select public.create_booking(%L, %L::date, %L::time, 'Street 1', gen_random_uuid())$$,
  tests.id('svc_x'), (select v::timestamp::date from fx where k = 'slot'), (select v::timestamp::time from fx where k = 'slot'))),
  'Booking date and time must be in the future', 'the same slot is still ahead for a barber at UTC-12');

update public.users set time_zone = 'Europe/Berlin' where id = tests.id('x');
select is(tests.visible(tests.id('a'), 'select private.local_now(gen_random_uuid())'), -1, 'local_now is not reachable through the API');

-- 2. Pending cap ignores requests whose time has passed ------------------------

delete from public.bookings where customer_id = tests.id('a') and status = 'pending';
alter table public.bookings disable trigger trg_validate_booking_slot;
insert into public.bookings (customer_id, barber_id, service_id, date, time, location, status)
select tests.id('a'), tests.id('x'), tests.id('svc_x'), current_date - d, '10:00', 'Somewhere 1', 'pending'
from generate_series(1, 5) d;
alter table public.bookings enable trigger trg_validate_booking_slot;
select is((select count(*) from public.bookings where customer_id = tests.id('a') and status = 'pending'), 5::bigint,
  'five unanswered past requests exist');
select is(tests.run(tests.id('a'), format(
  $$select public.create_booking(%L, current_date + 7, '10:00', 'Street 1', gen_random_uuid())$$, tests.id('svc_x'))),
  'ok', 'past pending requests no longer count toward the cap');
select is(tests.run(tests.id('a'), format(
  $$select public.create_booking(%L, current_date + 7, '14:00', 'Street 1', gen_random_uuid())$$, tests.id('svc_x'))),
  'ok', 'a second future request with the same barber is allowed');
select is(tests.run(tests.id('a'), format(
  $$select public.create_booking(%L, current_date + 7, '16:00', 'Street 1', gen_random_uuid())$$, tests.id('svc_x'))),
  'PA004', 'a third future request with the same barber is still capped');

-- 3. Verification review -------------------------------------------------------

insert into public.verification_requests (user_id, id_image_url)
values (tests.id('y'), tests.id('y') || '/id.jpg');

select throws_ok(format($$select private.review_barber_verification(%L, 'approved', %L)$$, tests.id('y'), tests.id('x')),
  '22023', 'both documents are required before approval', 'approval refuses a request with one document');
select is((select verification_status::text from public.barber_profile where user_id = tests.id('y')), 'pending', 'the barber stays pending');

update public.verification_requests set license_image_url = tests.id('y') || '/license.jpg' where user_id = tests.id('y');
select lives_ok(format($$select private.review_barber_verification(%L, 'approved', %L)$$, tests.id('y'), tests.id('x')),
  'a complete request can be approved');
select is((select verification_status::text || '/' || verified::text from public.barber_profile where user_id = tests.id('y')),
  'approved/true', 'the profile is approved and verified');
select is((select status::text || '/' || (reviewed_by = tests.id('x'))::text || '/' || (reviewed_at is not null)::text
             from public.verification_requests where user_id = tests.id('y')),
  'approved/true/true', 'the request records the decision and the reviewer');
select is(tests.visible(tests.id('a'), 'select 1 from public.barber_directory where id = ' || quote_literal(tests.id('y'))), 1,
  'the approved barber is discoverable');
select is(coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'none'), 'none', 'the service role does not leak past the call');

select lives_ok(format($$select private.review_barber_verification(%L, 'rejected', %L)$$, tests.id('y'), tests.id('x')),
  'a barber can be rejected');
select is((select verification_status::text || '/' || verified::text from public.barber_profile where user_id = tests.id('y')),
  'rejected/false', 'rejection clears the verified badge');

select is(tests.run(tests.id('y'), format($$select private.review_barber_verification(%L, 'approved', %L)$$, tests.id('y'), tests.id('y'))),
  '42501', 'a barber cannot review their own verification');

select * from finish();
rollback;
