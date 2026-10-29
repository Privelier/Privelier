-- Looks slice S6 (0068): the look pass shows a client only their own looks
-- they confirmed as their cut, the reference next to the result, result
-- photos only while the look is shown, and whether the barber can be booked
-- again. Real anon/authenticated roles; never commits.
--
-- Before the migrations are applied (rolled back at the end):
--   python tools/db/supa.py test --with supabase/migrations/0062_feature_flags.sql supabase/migrations/0063_looks_proof_and_match.sql supabase/migrations/0064_looks_reports_and_notifications.sql supabase/migrations/0065_looks_feed_and_reference.sql supabase/migrations/0066_looks_search.sql supabase/migrations/0067_looks_wishes_and_offers.sql supabase/migrations/0068_looks_pass.sql -- supabase/tests/looks_pass.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into fx values ('c', tests.new_user('customer', 'Cem Noflag'));
insert into private.feature_flag_users (flag_key, user_id)
select 'looks', id from (values (tests.id('a')), (tests.id('b')), (tests.id('x')), (tests.id('y'))) v(id);

-- Setup: barber x captures a's completed booking; a had booked it with a
-- reference photo (written directly: references attach only to pending
-- requests, this booking is already completed).
insert into storage.objects (bucket_id, name, owner) values ('looks', tests.id('x') || '/pass.jpg', tests.id('x'));
insert into public.look_references (booking_id, customer_id, look_id, style, photo_path)
values (tests.id('done'), tests.id('a'), null, 'skin_fade', tests.id('a') || '/ref.jpg');
insert into fx select 'look', tests.scalar(tests.id('x'), format($$select (public.create_look_draft(%L, '{skin_fade}', true)).id$$, tests.id('done')));
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/pass.jpg')), 'ok', 'setup: photo');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'ok', 'setup: sent');

-- ------------------------------------------------------------ audience --
select is(tests.run(null, 'select * from public.my_looks()'), '42501', 'anon has no look pass');
select is(tests.scalar(tests.id('a'), 'select count(*)::text from public.my_looks()'), '0', 'an unanswered draft is not in the pass');
select is(tests.run(tests.id('a'), format($$select public.respond_to_look(%L, true, true)$$, tests.id('look'))), 'ok', 'setup: the client confirms and shows it');
select is(tests.scalar(tests.id('a'), 'select count(*)::text from public.my_looks()'), '1', 'paired allow: the client sees their look');
select is(tests.scalar(tests.id('b'), 'select count(*)::text from public.my_looks()'), '0', 'another client does not');
select is(tests.scalar(tests.id('x'), 'select count(*)::text from public.my_looks()'), '0', 'the barber does not (their looks live in the studio)');
delete from private.feature_flag_users where user_id = tests.id('a');
select is(tests.scalar(tests.id('a'), 'select count(*)::text from public.my_looks()'), '0', 'flag off: no pass');
insert into private.feature_flag_users (flag_key, user_id) values ('looks', tests.id('a'));
select ok(not exists (
  select 1 from pg_proc p, unnest(p.proargnames) n
  where p.proname = 'my_looks' and n in ('customer_id', 'customer_name', 'address', 'location', 'latitude', 'longitude')
), 'the pass carries no address or coordinates');

-- -------------------------------------------------- reference and result --
select is(tests.scalar(tests.id('a'), format($$select (reference_photo_path = %L and reference_style = 'skin_fade' and photo_paths = array[%L]::text[] and can_rebook)::text from public.my_looks()$$,
  tests.id('a') || '/ref.jpg', tests.id('x') || '/pass.jpg')), 'true', 'the reference sits next to the result and the barber can be booked again');

select is(tests.run(tests.id('a'), format($$select public.withdraw_look(%L, 'hide')$$, tests.id('look'))), 'ok', 'the client stops showing the look');
select is(tests.scalar(tests.id('a'), $$select status || ':' || cardinality(photo_paths) from public.my_looks()$$), 'confirmed:0',
  'a look that is not shown stays in the pass, without result photos');

select is(tests.run(tests.id('a'), format($$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$$, tests.id('a'), tests.id('x'))), 'ok', 'the client blocks the barber');
select is(tests.scalar(tests.id('a'), 'select can_rebook::text from public.my_looks()'), 'false', 'no "this look again" across a block');
delete from public.user_blocks where blocker_id = tests.id('a');

select is(tests.run(tests.id('a'), format($$select public.withdraw_look(%L, 'withdraw')$$, tests.id('look'))), 'ok', 'the client takes the look back');
select is(tests.scalar(tests.id('a'), 'select count(*)::text from public.my_looks()'), '0', 'a withdrawn look leaves the pass');

select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute no public function');

select * from finish();
rollback;
