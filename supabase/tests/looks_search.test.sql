-- Looks slice S4 (0066): instant matches only for customers with the flag,
-- only barbers with proof in the style, free in the window (availability,
-- days off, bookings plus travel buffer), never a location; private
-- reference photos visible to their owner and the booked barber only.
--
-- Before the migrations are applied (rolled back at the end):
--   python tools/db/supa.py test --with supabase/migrations/0062_feature_flags.sql supabase/migrations/0063_looks_proof_and_match.sql supabase/migrations/0064_looks_reports_and_notifications.sql supabase/migrations/0065_looks_feed_and_reference.sql supabase/migrations/0066_looks_search.sql -- supabase/tests/looks_search.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into fx values ('c', tests.new_user('customer', 'Cem Noflag'));
insert into private.feature_flag_users (flag_key, user_id)
select 'looks', id from (values (tests.id('a')), (tests.id('b')), (tests.id('x')), (tests.id('y'))) v(id);

-- Setup: proof in skin_fade for barber x (confirmed, not shown).
insert into storage.objects (bucket_id, name, owner) values ('looks', tests.id('x') || '/s.jpg', tests.id('x'));
insert into fx select 'look', tests.scalar(tests.id('x'), format($$select (public.create_look_draft(%L, '{skin_fade}', true)).id$$, tests.id('done')));
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/s.jpg')), 'ok', 'setup: photo');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'ok', 'setup: sent');
select is(tests.run(tests.id('a'), format($$select public.respond_to_look(%L, true, false)$$, tests.id('look'))), 'ok', 'setup: confirmed without showing still counts as proof');

-- --------------------------------------------------------------- access --
select is(tests.run(null, $$select * from public.match_look('skin_fade', current_date + 7, '09:00', '12:00')$$), '42501', 'anon cannot search');
select is(tests.scalar(tests.id('c'), $$select count(*)::text from public.match_look('skin_fade', current_date + 7, '09:00', '12:00')$$), '0', 'flag off: no matches');
select is(tests.scalar(tests.id('y'), $$select count(*)::text from public.match_look('skin_fade', current_date + 7, '09:00', '12:00')$$), '0', 'barbers do not search');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 7, '09:00', '12:00')$$), '1', 'paired allow: a customer finds the barber with proof');
select is(tests.scalar(tests.id('b'), $$select first_free_time::text || ':' || (service_id::text = $$ || quote_literal(tests.id('svc_x')) || $$)::text from public.match_look('skin_fade', current_date + 7, '09:00', '12:00')$$), '09:00:00:true', 'the first free start and the look''s service are returned');
select ok(not exists (
  select 1 from pg_proc p, unnest(p.proargnames) n
  where p.proname = 'match_look' and n in ('latitude', 'longitude', 'display_latitude', 'address', 'distance', 'location')
), 'matches never carry a location or distance');

-- ----------------------------------------------------------- the rules --
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('taper', current_date + 7, '09:00', '12:00')$$), '0', 'no proof in the style, no match');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 7, '19:00', '21:00')$$), '0', 'outside availability, no match');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 7, '12:00', '09:00')$$), '0', 'a reversed window finds nothing');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 7, '05:00', '18:30')$$), '0', 'a window over twelve hours is refused');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date - 1, '09:00', '12:00')$$), '0', 'past days are refused');

insert into fx select 'bk9', tests.scalar(tests.id('b'), format(
  $$select (public.create_booking(%L, current_date + 7, '09:00', 'Customer street 5', gen_random_uuid())).id$$, tests.id('svc_x')));
select is(tests.scalar(tests.id('a'), $$select first_free_time::text from public.match_look('skin_fade', current_date + 7, '09:00', '12:00')$$), '10:30:00',
  'a booked hour and its 30-minute travel buffer are skipped, like create_booking');

select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 8, '09:00', '12:00')$$), '0', 'a weekday without availability finds nothing');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 14, '09:00', '12:00')$$), '1', 'the same weekday a week later is free');
insert into public.barber_days_off (barber_id, day) values (tests.id('x'), current_date + 14);
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 14, '09:00', '12:00')$$), '0', 'a day off finds nothing');

select is(tests.run(tests.id('b'), format($$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$$, tests.id('b'), tests.id('x'))), 'ok', 'b blocks the barber');
select is(tests.scalar(tests.id('b'), $$select count(*)::text from public.match_look('skin_fade', current_date + 7, '09:00', '12:00')$$), '0', 'no match across a block');
delete from public.user_blocks where blocker_id = tests.id('b');

-- ------------------------------------------------------ reference photos --
select is(tests.run(tests.id('b'), format($$insert into storage.objects (bucket_id, name, owner) values ('look-references', %L, %L)$$, tests.id('b') || '/ref.jpg', tests.id('b'))), 'ok', 'a customer uploads a reference photo into their own folder');
select is(tests.run(tests.id('a'), format($$insert into storage.objects (bucket_id, name, owner) values ('look-references', %L, %L)$$, tests.id('b') || '/x.jpg', tests.id('a'))), '42501', 'nobody uploads into another folder');
select is(tests.run(tests.id('x'), format($$insert into storage.objects (bucket_id, name, owner) values ('look-references', %L, %L)$$, tests.id('x') || '/x.jpg', tests.id('x'))), '42501', 'barbers do not upload reference photos');
select is(tests.visible(tests.id('x'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/ref.jpg')), 0, 'the barber cannot see it before it is attached');
select is(tests.run(tests.id('b'), format($$select public.attach_look_reference(%L, null, 'skin_fade', %L)$$, tests.id('bk9'), tests.id('a') || '/ref.jpg')), '22023', 'a reference photo must be the caller''s own upload');
select is(tests.run(tests.id('b'), format($$select public.attach_look_reference(%L, null, 'skin_fade', %L)$$, tests.id('bk9'), tests.id('b') || '/ref.jpg')), 'ok', 'paired allow: the photo is attached to the request');
select is(tests.visible(tests.id('x'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/ref.jpg')), 1, 'the booked barber can open it');
select is(tests.visible(tests.id('y'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/ref.jpg')), 0, 'another barber cannot');
select is(tests.visible(tests.id('a'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/ref.jpg')), 0, 'another customer cannot');
select is(tests.run(tests.id('x'), format($$update public.bookings set status = 'rejected' where id = %L$$, tests.id('bk9'))), 'ok', 'the barber declines the request');
select is(tests.visible(tests.id('x'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/ref.jpg')), 0, 'access ends with the request');

select ok(not exists (select 1 from storage.buckets where id = 'look-references' and (public or file_size_limit is null or allowed_mime_types is null)),
  'the reference bucket is private with a size limit and an image-only MIME list');
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute no public function');

select * from finish();
rollback;
