-- Authorization matrix: anon, customer A, customer B, approved barber X and
-- pending barber Y against every exposed object. Each deny has a paired
-- allow so an empty result cannot pass by accident. Statements run as the
-- real `anon` / `authenticated` roles with JWT claims set; nothing runs as
-- service role. Synthetic users only; the transaction never commits.
--
-- Run: python tools/db/supa.py test supabase/tests/authorization_matrix.test.sql
-- (or `supabase test db` against a local stack).
begin;
select * from no_plan();

\ir _fixtures.psql

-- ---------------------------------------------------------------- anon --
select is(tests.run(null, 'select * from public.users'), '42501', 'anon cannot read users');
select is(tests.run(null, 'select * from public.barber_directory'), '42501', 'anon cannot read the barber directory');
select is(tests.run(null, 'select * from public.reviews'), '42501', 'anon cannot read reviews');
select is(tests.run(null, 'select * from public.portfolio'), '42501', 'anon cannot read portfolio rows');
select is(tests.run(null, $$insert into public.bookings (customer_id, barber_id, service_id, date, time, location) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), current_date, '10:00', 'x')$$),
  '42501', 'anon cannot insert bookings');
select is(tests.run(null, $$insert into public.messages (chat_id, sender_id, message) values (gen_random_uuid(), gen_random_uuid(), 'hi')$$),
  '42501', 'anon cannot insert messages');
select is(tests.run(null, $$select public.create_booking(gen_random_uuid(), current_date, '10:00', 'x', gen_random_uuid())$$),
  '42501', 'anon cannot call create_booking');
select is(tests.run(null, 'select public.delete_own_account()'), '42501', 'anon cannot call delete_own_account');
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_directory where id = %L', tests.id('x'))), 1, 'paired allow: a customer reads the directory');

-- ---------------------------------------------------------- users/roles --
select is(tests.visible(tests.id('a'), format('select 1 from public.users where id = %L', tests.id('a'))), 1, 'customer reads own user row');
select is(tests.visible(tests.id('a'), format('select 1 from public.users where id = %L', tests.id('b'))), 0, 'customer cannot read another user row');
select is(tests.run(tests.id('a'), format($$update public.users set role = 'admin' where id = %L$$, tests.id('a'))), '42501', 'customer cannot promote own role');
select is(tests.affected(tests.id('a'), format($$update public.users set name = 'Ada Renamed' where id = %L$$, tests.id('a'))), 1, 'paired allow: customer renames self');
select is(tests.run(tests.id('a'), format($$update public.users set accepted_terms_version = 'x' where id = %L$$, tests.id('a'))), '42501', 'consent columns only change through the consent RPC');

-- ------------------------------------------------- barber verification --
select is(tests.run(tests.id('y'), format($$update public.barber_profile set verification_status = 'approved' where user_id = %L$$, tests.id('y'))), '42501', 'pending barber cannot self-approve');
select is(tests.run(tests.id('y'), format($$update public.barber_profile set verified = true where user_id = %L$$, tests.id('y'))), '42501', 'pending barber cannot set verified');
select is(tests.run(tests.id('x'), format($$update public.barber_profile set rating = 5 where user_id = %L$$, tests.id('x'))), '42501', 'barber cannot forge a rating');
select is(tests.affected(tests.id('y'), format($$update public.barber_profile set bio = 'New bio' where user_id = %L$$, tests.id('y'))), 1, 'paired allow: barber edits own bio');
select is(tests.run(tests.id('y'), format($$insert into public.verification_requests (user_id, status) values (%L, 'approved')$$, tests.id('y'))), '42501', 'barber cannot submit an approved verification');
select is(tests.run(tests.id('y'), format($$insert into public.verification_requests (user_id, id_image_url) values (%L, %L)$$, tests.id('y'), tests.id('y') || '/id.jpg')), 'ok', 'paired allow: barber submits own documents');
select is(tests.visible(tests.id('x'), 'select 1 from public.verification_requests'), 0, 'barber cannot read another barber verification');

-- ------------------------------------------------------ location privacy --
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_location where user_id = %L', tests.id('x'))), 0, 'customer cannot read a barber exact location');
select is(tests.visible(tests.id('x'), format('select 1 from public.barber_location where user_id = %L', tests.id('x'))), 1, 'paired allow: barber reads own location');
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_directory where id = %L', tests.id('y'))), 0, 'pending barber is not in the directory');
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_directory where id = %L', tests.id('x'))), 1, 'approved barber is in the directory');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name in ('barber_directory', 'barber_public_profile')
    and column_name in ('latitude', 'longitude', 'address', 'email', 'phone')
), 'directory projection carries no exact coordinates, address, email or phone');

-- --------------------------------------------------- services/portfolio --
select is(tests.visible(tests.id('a'), format('select 1 from public.services where barber_id = %L', tests.id('x'))), 1, 'customer sees an approved barber service');
select is(tests.visible(tests.id('a'), format('select 1 from public.services where barber_id = %L', tests.id('y'))), 0, 'customer cannot see a pending barber service');
select is(tests.run(tests.id('a'), format($$insert into public.services (barber_id, name, price, duration_minutes) values (%L, 'Fake', 1, 30)$$, tests.id('a'))), '42501', 'customer cannot create services');
select is(tests.affected(tests.id('y'), format($$update public.services set price = 1 where id = %L$$, tests.id('svc_x'))), 0, 'barber cannot edit another barber service');
select is(tests.affected(tests.id('x'), format($$update public.services set price = 40 where id = %L$$, tests.id('svc_x'))), 1, 'paired allow: barber edits own service');
select is(tests.run(tests.id('a'), format($$insert into public.portfolio (barber_id, image_url) values (%L, 'x.jpg')$$, tests.id('a'))), '42501', 'customer cannot add portfolio rows');

-- -------------------------------------------------------------- bookings --
insert into fx values ('key', gen_random_uuid()::text);
insert into fx select 'bk', tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:00', 'Customer street 5', %L)).id$$,
  tests.id('svc_x'), tests.id('key')));
select ok(tests.id('bk') is not null, 'customer creates a booking through create_booking');
select is(tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:00', 'Customer street 5', %L)).id$$,
  tests.id('svc_x'), tests.id('key'))), tests.id('bk')::text, 'the same idempotency key returns the same booking');
select is((select price from public.bookings where id = tests.id('bk')), 40.00::numeric, 'price is stamped from the service row');
select is(tests.run(tests.id('a'), format(
  $$insert into public.bookings (customer_id, barber_id, service_id, date, time, location, price) values (%L, %L, %L, current_date + 7, '14:00', 'x', 1)$$,
  tests.id('a'), tests.id('x'), tests.id('svc_x'))), '42501', 'a client-supplied price is refused');
select is(tests.scalar(tests.id('b'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:30', 'Other street', gen_random_uuid())).id$$,
  tests.id('svc_x'))), 'error:P0001', 'an overlapping request for the same barber is refused');
select is(tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:00', 'x', gen_random_uuid())).id$$,
  tests.id('svc_y'))), 'error:P0002', 'a pending barber cannot be booked');
select is(tests.visible(tests.id('b'), format('select 1 from public.bookings where id = %L', tests.id('bk'))), 0, 'another customer cannot read the booking');
select is(tests.visible(tests.id('x'), format('select 1 from public.bookings where id = %L', tests.id('bk'))), 1, 'paired allow: the barber reads the booking');
select is(tests.run(tests.id('a'), format($$update public.bookings set status = 'accepted' where id = %L$$, tests.id('bk'))), 'P0001', 'the customer cannot accept');
select is(tests.run(tests.id('a'), format($$update public.bookings set location = 'Elsewhere' where id = %L$$, tests.id('bk'))), '42501', 'booking fields other than status are not writable');
select is(tests.affected(tests.id('x'), format($$update public.bookings set status = 'accepted' where id = %L$$, tests.id('bk'))), 1, 'paired allow: the barber accepts');

-- Exclusion constraint, independent of the slot trigger.
alter table public.bookings disable trigger trg_validate_booking_slot;
select throws_ok(
  format($$insert into public.bookings (customer_id, barber_id, service_id, date, time, location) values (%L, %L, %L, current_date + 7, '10:15', 'x')$$,
    tests.id('b'), tests.id('x'), tests.id('svc_x')),
  '23P01', null, 'the exclusion constraint refuses an overlap even when the trigger is bypassed');
-- Travel buffer (0060): a 10:00-11:00 booking keeps the barber free until 11:30.
select throws_ok(
  format($$insert into public.bookings (customer_id, barber_id, service_id, date, time, location) values (%L, %L, %L, current_date + 7, '11:00', 'x')$$,
    tests.id('b'), tests.id('x'), tests.id('svc_x')),
  '23P01', null, 'the constraint keeps 30 minutes of travel time after a booking');
select lives_ok(
  format($$insert into public.bookings (customer_id, barber_id, service_id, date, time, location) values (%L, %L, %L, current_date + 7, '11:30', 'x')$$,
    tests.id('b'), tests.id('x'), tests.id('svc_x')),
  'paired allow: a booking that starts when the travel time ends is accepted');
alter table public.bookings enable trigger trg_validate_booking_slot;
select is(tests.scalar(tests.id('b'), format(
  $$select (public.create_booking(%L, current_date + 7, '12:45', 'x', gen_random_uuid())).id$$,
  tests.id('svc_x'))), 'error:P0001', 'the slot trigger refuses a request inside the travel time before a booking');
select is((select min(start_time)::text from public.get_barber_busy_slots(tests.id('x')::uuid, current_date + 7)), '09:30:00',
  'busy slots include the travel time, so the picker never offers a refused time');

-- ------------------------------------------------------------------ chat --
insert into fx select 'chat', id::text from public.chat_rooms where booking_id = tests.id('bk');
select is(tests.run(tests.id('a'), format($$insert into public.chat_rooms (booking_id, customer_id, barber_id) values (%L, %L, %L)$$, tests.id('done'), tests.id('a'), tests.id('x'))), '42501', 'clients cannot create chat rooms');
select is(tests.run(tests.id('a'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'See you then')$$, tests.id('chat'), tests.id('a'))), 'ok', 'participant sends a message');
select is(tests.run(tests.id('a'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'Forged')$$, tests.id('chat'), tests.id('x'))), '42501', 'nobody can send as someone else');
select is(tests.run(tests.id('b'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'Intruder')$$, tests.id('chat'), tests.id('b'))), '42501', 'a non-participant cannot post');
select is(tests.visible(tests.id('b'), format('select 1 from public.messages where chat_id = %L', tests.id('chat'))), 0, 'a non-participant cannot read the chat');
select is(tests.visible(tests.id('x'), format('select 1 from public.messages where chat_id = %L', tests.id('chat'))), 1, 'paired allow: the other participant reads it');
select is(tests.run(tests.id('a'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, repeat('a', 2001))$$, tests.id('chat'), tests.id('a'))), '23514', 'messages over 2000 characters are refused');
select is(tests.run(tests.id('a'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'kys loser')$$, tests.id('chat'), tests.id('a'))), 'PA030', 'denylisted language is refused');
select is(tests.run(tests.id('x'), format($$update public.messages set message = 'edited' where chat_id = %L$$, tests.id('chat'))), '42501', 'messages cannot be edited');

-- Realtime typing channel: participants only.
-- Realtime creates its daily partitions only while it has traffic (postgres
-- may not create them). "no partition of relation messages" here means:
-- open any Realtime channel on the project once, then rerun.
insert into realtime.messages (topic, extension, payload, event, private)
values ('typing:' || tests.id('chat'), 'broadcast', '{}', 'typing', true);
select set_config('realtime.topic', 'typing:' || tests.id('chat'), true);
select is(tests.visible(tests.id('b'), $$select 1 from realtime.messages where extension = 'broadcast'$$), 0, 'a non-participant cannot join the typing channel');
select ok(tests.visible(tests.id('x'), $$select 1 from realtime.messages where extension = 'broadcast'$$) >= 1, 'paired allow: a participant can');

-- --------------------------------------------------------------- reviews --
select isnt(tests.run(tests.id('b'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 5)$$, tests.id('done'), tests.id('b'), tests.id('x'))), 'ok', 'cannot review a booking that is not yours');
select isnt(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 5)$$, tests.id('bk'), tests.id('a'), tests.id('x'))), 'ok', 'cannot review a booking that is not completed');
select is(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating, comment) values (%L, %L, %L, 9, 'x')$$, tests.id('done'), tests.id('a'), tests.id('x'))), '23514', 'ratings outside 1-5 are refused');
select is(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating, comment) values (%L, %L, %L, 5, 'Great cut')$$, tests.id('done'), tests.id('a'), tests.id('x'))), 'ok', 'paired allow: the customer reviews a completed booking');
select is(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 4)$$, tests.id('done'), tests.id('a'), tests.id('x'))), '23505', 'one review per booking');
select is(tests.run(tests.id('a'), format($$update public.reviews set rating = 1 where booking_id = %L$$, tests.id('done'))), '42501', 'reviews cannot be edited');
select is((select rating from public.barber_profile where user_id = tests.id('x')), 5.00::numeric, 'the rating aggregate is recomputed server-side');

-- ------------------------------------------------- notifications/blocks --
select is(tests.visible(tests.id('b'), format('select 1 from public.notifications where recipient_id = %L', tests.id('x'))), 0, 'cannot read another user notifications');
select ok(tests.visible(tests.id('x'), format('select 1 from public.notifications where recipient_id = %L', tests.id('x'))) >= 1, 'paired allow: own notifications');
select is(tests.run(tests.id('a'), format($$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$$, tests.id('b'), tests.id('x'))), '42501', 'cannot block on behalf of someone else');
select is(tests.run(tests.id('a'), format($$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$$, tests.id('a'), tests.id('x'))), 'ok', 'customer blocks the barber');
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_directory where id = %L', tests.id('x'))), 0, 'a blocked barber disappears from discovery');
select is(tests.run(tests.id('a'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'still there?')$$, tests.id('chat'), tests.id('a'))), '42501', 'a block stops new messages');
select is(tests.scalar(tests.id('a'), format($$select (public.create_booking(%L, current_date + 7, '15:00', 'x', gen_random_uuid())).id$$, tests.id('svc_x'))), 'error:42501', 'a block stops new bookings');
select is(tests.visible(tests.id('b'), format('select 1 from public.barber_directory where id = %L', tests.id('x'))), 1, 'paired allow: other customers still see the barber');

-- ------------------------------------------------------- remaining tables --
insert into public.customer_addresses (customer_id, label, address) values (tests.id('b'), 'Home', 'Private street 9');
select is(tests.visible(tests.id('a'), 'select 1 from public.customer_addresses'), 0, 'saved addresses are private to their owner');
select is(tests.visible(tests.id('b'), 'select 1 from public.customer_addresses'), 1, 'paired allow: the owner sees own addresses');
select is(tests.run(tests.id('a'), format($$insert into public.customer_addresses (customer_id, label, address) values (%L, 'x', 'x')$$, tests.id('b'))), '42501', 'nobody saves an address for someone else');
select is(tests.affected(tests.id('a'), 'delete from public.customer_addresses'), 0, 'nobody deletes another user''s addresses');

select is(tests.run(tests.id('b'), format($$insert into public.customer_favorites (customer_id, barber_id) values (%L, %L)$$, tests.id('b'), tests.id('y'))), '42501', 'a pending barber cannot be favorited');
select is(tests.run(tests.id('b'), format($$insert into public.customer_favorites (customer_id, barber_id) values (%L, %L)$$, tests.id('b'), tests.id('x'))), 'ok', 'paired allow: favorite an approved barber');
select is(tests.visible(tests.id('a'), 'select 1 from public.customer_favorites'), 0, 'favorites are private to their owner');

select is(tests.run(tests.id('a'), format($$insert into public.barber_days_off (barber_id, day) values (%L, current_date + 3)$$, tests.id('a'))), '42501', 'a customer cannot create days off');
select is(tests.run(tests.id('x'), format($$insert into public.barber_days_off (barber_id, day) values (%L, current_date + 3)$$, tests.id('x'))), 'ok', 'paired allow: the barber sets a day off');
select is(tests.run(tests.id('y'), format($$insert into public.barber_days_off (barber_id, day) values (%L, current_date + 4)$$, tests.id('x'))), '42501', 'nobody sets days off for another barber');

select is(tests.visible(tests.id('a'), format('select 1 from public.barber_stats where barber_id = %L', tests.id('y'))), 0, 'a pending barber''s stats are hidden');
select is(tests.visible(tests.id('a'), 'select 1 from public.push_tokens'), -1, 'push tokens are not readable through the API');
select is(tests.run(tests.id('a'), 'select public.register_push_token(''ExponentPushToken[test]'', ''ios'', ''en'')'), 'ok', 'paired allow: tokens are registered through the RPC');
select is(tests.visible(tests.id('a'), 'select 1 from public.waitlist'), 0, 'the waitlist is founders-only');
select ok(tests.visible(tests.id('a'), 'select 1 from public.legal_current_versions') >= 1, 'signed-in users read the current legal versions');
select is(tests.run(tests.id('a'), 'insert into public.legal_consent_history (user_id) values (gen_random_uuid())'), '42501', 'consent history is written only by the consent RPC');
select is(tests.visible(tests.id('a'), 'select 1 from public.booking_trips'), 0, 'trips are visible only to their two participants');

insert into fx select 'note', id::text from public.notifications where recipient_id = tests.id('x') limit 1;
select is(tests.affected(tests.id('a'), format('update public.notifications set read_at = now() where id = %L', tests.id('note'))), 0, 'nobody marks another user''s notification read');
select is(tests.affected(tests.id('x'), format('update public.notifications set read_at = now() where id = %L', tests.id('note'))), 1, 'paired allow: the recipient marks it read');
select is(tests.run(tests.id('x'), format('update public.notifications set recipient_id = %L where id = %L', tests.id('a'), tests.id('note'))), '42501', 'a notification cannot be redirected');

select is(tests.run(tests.id('b'), format($$insert into public.chat_read_state (chat_id, user_id, last_read_at) values (%L, %L, now())$$, tests.id('chat'), tests.id('b'))), '42501', 'a non-participant cannot mark a chat read');
select is(tests.run(tests.id('x'), format($$insert into public.chat_read_state (chat_id, user_id, last_read_at) values (%L, %L, now()) on conflict (chat_id, user_id) do update set last_read_at = excluded.last_read_at$$, tests.id('chat'), tests.id('x'))), 'ok', 'paired allow: a participant marks it read');

select is(tests.run(tests.id('b'), format($$insert into public.safety_events (booking_id, user_id, kind) values (%L, %L, 'sos')$$, tests.id('bk'), tests.id('b'))), '42501', 'a non-participant cannot log a safety event on a booking');
select is(tests.run(tests.id('a'), format($$insert into public.safety_events (booking_id, user_id, kind) values (%L, %L, 'sos')$$, tests.id('bk'), tests.id('a'))), 'ok', 'paired allow: a participant can');
select is(tests.visible(tests.id('x'), 'select 1 from public.safety_events'), 0, 'safety events are private to whoever logged them');

-- ---------------------------------------------------------------- storage --
insert into storage.objects (bucket_id, name, owner) values
  ('verification-docs', tests.id('y') || '/id.jpg', tests.id('y')),
  ('portfolio', tests.id('x') || '/one.jpg', tests.id('x'));
select is(tests.visible(tests.id('a'), $$select 1 from storage.objects where bucket_id = 'verification-docs'$$), 0, 'a customer cannot list or read verification documents');
select is(tests.visible(tests.id('x'), $$select 1 from storage.objects where bucket_id = 'verification-docs'$$), 0, 'another barber cannot list verification documents');
select is(tests.visible(tests.id('y'), $$select 1 from storage.objects where bucket_id = 'verification-docs'$$), 1, 'paired allow: the owner sees own documents');
select is(tests.visible(tests.id('a'), $$select 1 from storage.objects where bucket_id = 'portfolio'$$), 0, 'nobody can list the public portfolio bucket');
select is(tests.visible(tests.id('x'), $$select 1 from storage.objects where bucket_id = 'portfolio'$$), 1, 'paired allow: the owner lists own portfolio files');
select is(tests.run(tests.id('a'), format($$insert into storage.objects (bucket_id, name, owner) values ('verification-docs', %L, %L)$$, tests.id('y') || '/fake.jpg', tests.id('a'))), '42501', 'nobody writes into another user folder');
select ok(not exists (
  select 1 from storage.buckets
  where file_size_limit is null or allowed_mime_types is null
     or allowed_mime_types && array['image/svg+xml', 'text/html']
), 'every bucket has a size limit and an image-only MIME allowlist');
select ok((select not public from storage.buckets where id = 'verification-docs'), 'the verification bucket is private');

-- ------------------------------------------------------- database hygiene --
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, 'RLS is enabled on every public table');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and roles = '{public}'), 0, 'no policy targets the public role');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and cmd = 'ALL'), 0, 'no FOR ALL policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and cmd = 'UPDATE' and with_check is null), 0, 'every UPDATE policy has WITH CHECK');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
             and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
               or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))), 0,
  'anon holds no table privilege');
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute no public function');
select is((select count(*)::integer from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
           and not coalesce('security_invoker=true' = any(c.reloptions), false)), 0, 'every view is security_invoker');
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
           and p.proconfig is null), 0, 'every SECURITY DEFINER function pins search_path');
select ok(not exists (select 1 from pg_extension where extname = 'pg_graphql'), 'pg_graphql is not installed');
select is((select count(*)::integer from pg_proc where pronamespace = 'public'::regnamespace
           and proname in ('has_role', 'is_admin', 'is_blocked_between')), 0, 'policy helpers are not served as RPC endpoints');
select ok(has_function_privilege('authenticated', 'private.has_role(public.user_role)', 'execute'), 'policies can still evaluate their helpers');

select * from finish();
rollback;
