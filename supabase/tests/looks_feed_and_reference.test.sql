-- Looks slice S3 (0065): the feed's audience (customers only, same city,
-- published, approved, never across a block), the proof chain carries no
-- client identity, photo access for feed viewers, and attaching a look to a
-- new pending booking. Real anon/authenticated roles; never commits.
--
-- Before the migrations are applied (rolled back at the end):
--   python tools/db/supa.py test --with supabase/migrations/0062_feature_flags.sql supabase/migrations/0063_looks_proof_and_match.sql supabase/migrations/0064_looks_reports_and_notifications.sql supabase/migrations/0065_looks_feed_and_reference.sql -- supabase/tests/looks_feed_and_reference.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into fx values ('c', tests.new_user('customer', 'Cem Noflag'));
insert into private.feature_flag_users (flag_key, user_id)
select 'looks', id from (values (tests.id('a')), (tests.id('b')), (tests.id('x')), (tests.id('y'))) v(id);

-- Setup: customer a publishes a look barber x captured on the completed booking.
insert into storage.objects (bucket_id, name, owner) values ('looks', tests.id('x') || '/feed.jpg', tests.id('x'));
insert into fx select 'look', tests.scalar(tests.id('x'), format($$select (public.create_look_draft(%L, '{skin_fade}', true)).id$$, tests.id('done')));
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/feed.jpg')), 'ok', 'setup: photo');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'ok', 'setup: sent');
select is(tests.scalar(tests.id('b'), 'select count(*)::text from public.looks_feed()'), '0', 'a draft never reaches the feed');
select is(tests.run(tests.id('a'), format($$select public.respond_to_look(%L, true, true)$$, tests.id('look'))), 'ok', 'setup: published');

-- ------------------------------------------------------------ audience --
select is(tests.run(null, 'select * from public.looks_feed()'), '42501', 'anon cannot read the feed');
select is(tests.scalar(tests.id('c'), 'select count(*)::text from public.looks_feed()'), '0', 'flag off: no feed');
select is(tests.scalar(tests.id('b'), 'select count(*)::text from public.looks_feed()'), '1', 'paired allow: a customer in the same city sees the look');
select is(tests.scalar(tests.id('y'), 'select count(*)::text from public.looks_feed()'), '0', 'barbers do not see the feed (L2)');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.looks_feed('taper')$$), '0', 'the style filter excludes other styles');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.looks_feed('skin_fade')$$), '1', 'paired allow: the matching style');
select is(tests.scalar(tests.id('b'), format($$select count(*)::text from public.looks_feed(null, null, 20, %L)$$, tests.id('look'))), '1', 'the detail reads one look by id');
select is(tests.scalar(tests.id('b'), $$select (photo_paths = array[$$ || quote_literal(tests.id('x') || '/feed.jpg') || $$]::text[])::text from public.looks_feed()$$), 'true', 'the feed carries the photo paths in order');
select is(tests.scalar(tests.id('b'), 'select (arrival_confirmed = false and review_rating is null)::text from public.looks_feed()'), 'true', 'the proof chain is booleans and a rating only');
select ok(not exists (
  select 1 from pg_proc p, unnest(p.proargnames) n
  where p.proname = 'looks_feed' and n in ('customer_id', 'customer_name', 'location', 'latitude', 'longitude', 'address')
), 'the feed never returns the client, an address or coordinates');

update public.users set city = '  TESTSTADT ' where id = tests.id('b');
select is(tests.scalar(tests.id('b'), 'select count(*)::text from public.looks_feed()'), '1', 'the city match is trimmed and case-insensitive, like discovery');
update public.users set city = 'Elsewhere' where id = tests.id('b');
select is(tests.scalar(tests.id('b'), 'select count(*)::text from public.looks_feed()'), '0', 'another city sees nothing');
update public.users set city = 'Teststadt' where id = tests.id('b');

-- -------------------------------------------------------------- photos --
select is(tests.visible(tests.id('b'), format($$select 1 from storage.objects where bucket_id = 'looks' and name = %L$$, tests.id('x') || '/feed.jpg')), 1, 'a feed viewer can open the published photo');
select is(tests.visible(tests.id('c'), format($$select 1 from storage.objects where bucket_id = 'looks' and name = %L$$, tests.id('x') || '/feed.jpg')), 0, 'flag off: no photo');
select is(tests.visible(tests.id('y'), format($$select 1 from storage.objects where bucket_id = 'looks' and name = %L$$, tests.id('x') || '/feed.jpg')), 0, 'another barber cannot open it');

-- ----------------------------------------------------------- reference --
insert into fx select 'bk', tests.scalar(tests.id('b'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:00', 'Customer street 5', gen_random_uuid())).id$$, tests.id('svc_x')));
select ok(tests.id('bk') is not null, 'setup: b books the barber through the unchanged create_booking');
select is(tests.run(tests.id('a'), format($$select public.attach_look_reference(%L, %L, 'skin_fade')$$, tests.id('bk'), tests.id('look'))), 'P0002', 'only the booking''s customer attaches a reference');
select is(tests.run(tests.id('b'), format($$select public.attach_look_reference(%L, %L, 'no_such')$$, tests.id('bk'), tests.id('look'))), '22023', 'the style must be listed');
select is(tests.run(tests.id('b'), format($$select public.attach_look_reference(%L, gen_random_uuid(), 'skin_fade')$$, tests.id('bk'))), 'P0002', 'an unknown look cannot be attached');
select is(tests.run(tests.id('b'), format($$select public.attach_look_reference(%L, %L, 'skin_fade')$$, tests.id('bk'), tests.id('look'))), 'ok', 'paired allow: the customer attaches the look');
select is(tests.run(tests.id('b'), format($$select public.attach_look_reference(%L, %L, 'skin_fade')$$, tests.id('bk'), tests.id('look'))), '23505', 'one reference per booking');
select is(tests.visible(tests.id('x'), format('select 1 from public.look_references where booking_id = %L', tests.id('bk'))), 1, 'the booked barber sees the reference');
select is(tests.visible(tests.id('a'), format('select 1 from public.look_references where booking_id = %L', tests.id('bk'))), 0, 'nobody else does');
select is(tests.run(tests.id('b'), format($$insert into public.look_references (booking_id, customer_id, style) values (%L, %L, 'taper')$$, tests.id('done'), tests.id('b'))), '42501', 'references are written only through the function');
select is(tests.run(tests.id('a'), format($$select public.attach_look_reference(%L, null, 'skin_fade')$$, tests.id('done'))), 'P0002', 'a completed booking takes no reference');
select is((select status::text from public.bookings where id = tests.id('bk')), 'pending', 'the booking stays a normal pending request');

-- ---------------------------------------------------------- blocks, hide --
select is(tests.run(tests.id('b'), format($$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$$, tests.id('b'), tests.id('x'))), 'ok', 'b blocks the barber');
select is(tests.scalar(tests.id('b'), 'select count(*)::text from public.looks_feed()'), '0', 'no feed across a block');
select is(tests.visible(tests.id('b'), format($$select 1 from storage.objects where bucket_id = 'looks' and name = %L$$, tests.id('x') || '/feed.jpg')), 0, 'and no photo');
delete from public.user_blocks where blocker_id = tests.id('b');
select is(tests.run(tests.id('a'), format($$select public.withdraw_look(%L, 'hide')$$, tests.id('look'))), 'ok', 'the client stops showing the look');
select is(tests.scalar(tests.id('b'), 'select count(*)::text from public.looks_feed()'), '0', 'a hidden look leaves the feed at once');

select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute no public function');

select * from finish();
rollback;
