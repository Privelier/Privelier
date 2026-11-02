-- Release invariants 1-10 (the eleventh, no service_role key in clients, is
-- a gitleaks and bundle check). Personas: anon, customers A and B, approved
-- barbers X and W, pending barber Y. Every deny is paired with an allow so an
-- empty result cannot pass by accident. Synthetic users only; the
-- transaction never commits.
--
-- Run: python tools/db/supa.py test supabase/tests/release_invariants.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into fx values ('w', tests.new_user('barber', 'Wanda Barber'));
select tests.approve(tests.id('w'));
insert into public.services (barber_id, name, price, duration_minutes) values (tests.id('w'), 'Cut', 50, 30);
insert into fx select 'svc_w', id::text from public.services where barber_id = tests.id('w');

-- Three pending requests with barber X: A at 10:00 and 13:00, B at 16:00.
insert into fx select 'bk_done', tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:00', 'Street 1', gen_random_uuid())).id$$, tests.id('svc_x')));
insert into fx select 'bk_reject', tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '13:00', 'Street 1', gen_random_uuid())).id$$, tests.id('svc_x')));
insert into fx select 'bk_cancel', tests.scalar(tests.id('b'), format(
  $$select (public.create_booking(%L, current_date + 7, '16:00', 'Street 2', gen_random_uuid())).id$$, tests.id('svc_x')));
select ok((select count(*) from public.bookings where id in (tests.id('bk_done'), tests.id('bk_reject'), tests.id('bk_cancel'))) = 3,
  'setup: three pending requests exist');

-- 1. Only the booked barber accepts, rejects or completes ----------------------
select is(tests.affected(tests.id('w'), format($$update public.bookings set status = 'accepted' where id = %L$$, tests.id('bk_done'))), 0,
  'inv1: another approved barber cannot accept');
select is(tests.run(tests.id('a'), format($$update public.bookings set status = 'rejected' where id = %L$$, tests.id('bk_reject'))), 'P0001',
  'inv1: the customer cannot reject');
select is(tests.affected(tests.id('x'), format($$update public.bookings set status = 'accepted' where id = %L$$, tests.id('bk_done'))), 1,
  'inv1 allow: the booked barber accepts');
select is(tests.run(tests.id('a'), format($$update public.bookings set status = 'completed' where id = %L$$, tests.id('bk_done'))), 'P0001',
  'inv1: the customer cannot complete');
select is(tests.affected(tests.id('w'), format($$update public.bookings set status = 'completed' where id = %L$$, tests.id('bk_done'))), 0,
  'inv1: another barber cannot complete');
select is(tests.affected(tests.id('x'), format($$update public.bookings set status = 'completed' where id = %L$$, tests.id('bk_done'))), 1,
  'inv1 allow: the booked barber completes');
select is(tests.affected(tests.id('w'), format($$update public.bookings set status = 'rejected' where id = %L$$, tests.id('bk_reject'))), 0,
  'inv1: another barber cannot reject');
select is(tests.affected(tests.id('x'), format($$update public.bookings set status = 'rejected' where id = %L$$, tests.id('bk_reject'))), 1,
  'inv1 allow: the booked barber rejects');
select is(tests.run(tests.id('x'), format($$update public.bookings set status = 'accepted' where id = %L$$, tests.id('bk_reject'))), 'P0001',
  'inv1: a rejected booking cannot be revived');

-- 2. Only the customer cancels a pending booking -------------------------------
select is(tests.run(tests.id('x'), format($$update public.bookings set status = 'cancelled' where id = %L$$, tests.id('bk_cancel'))), 'P0001',
  'inv2: the barber cannot cancel a pending request');
select is(tests.affected(tests.id('a'), format($$update public.bookings set status = 'cancelled' where id = %L$$, tests.id('bk_cancel'))), 0,
  'inv2: another customer cannot cancel it');
select is(tests.affected(tests.id('b'), format($$update public.bookings set status = 'cancelled' where id = %L$$, tests.id('bk_cancel'))), 1,
  'inv2 allow: the booking customer cancels');
select is(tests.run(tests.id('b'), format($$update public.bookings set status = 'pending' where id = %L$$, tests.id('bk_cancel'))), 'P0001',
  'inv2: a cancelled booking stays cancelled');

-- 3. Exact barber coordinates: the barber only ---------------------------------
select is(tests.visible(tests.id('w'), format('select latitude from public.barber_location where user_id = %L', tests.id('x'))), 0,
  'inv3: another barber cannot read exact coordinates');
select is(tests.visible(tests.id('a'), format('select latitude from public.barber_location where user_id = %L', tests.id('x'))), 0,
  'inv3: a customer cannot read exact coordinates');
select is(tests.run(null, 'select latitude from public.barber_location'), '42501', 'inv3: anon cannot read exact coordinates');
select is(tests.visible(tests.id('x'), format('select latitude from public.barber_location where user_id = %L', tests.id('x'))), 1,
  'inv3 allow: the barber reads own coordinates');
select is((select count(*)::int from information_schema.columns where table_schema = 'public'
            and table_name in ('barber_directory', 'barber_public_profile') and column_name in ('latitude', 'longitude', 'address')), 0,
  'inv3: discovery projections carry no exact coordinates or address');

-- 4. A customer's real name reaches a barber only through a shared booking -----
select is(tests.visible(tests.id('x'), format('select name from public.users where id = %L', tests.id('a'))), 0,
  'inv4: a barber cannot read the customer row directly');
select is(tests.scalar(tests.id('x'), format('select name from public.get_booking_counterparts(array[%L]::uuid[])', tests.id('bk_done'))), 'Ada Customer',
  'inv4 allow: the booked barber gets the name through the counterpart lookup');
select is(tests.visible(tests.id('w'), format('select 1 from public.get_booking_counterparts(array[%L]::uuid[])', tests.id('bk_done'))), 0,
  'inv4: an unrelated barber gets nothing from the lookup');

-- 5. Reviews: completed booking, its own barber, never edited or deleted ------
select isnt(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 5)$$,
  tests.id('bk_done'), tests.id('a'), tests.id('w'))), 'ok', 'inv5: a review cannot name another barber');
select isnt(tests.run(tests.id('x'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 5)$$,
  tests.id('bk_done'), tests.id('x'), tests.id('x'))), 'ok', 'inv5: the barber cannot review own booking');
select isnt(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 5)$$,
  tests.id('bk_reject'), tests.id('a'), tests.id('x'))), 'ok', 'inv5: a rejected booking cannot be reviewed');
select is(tests.run(tests.id('a'), format($$insert into public.reviews (booking_id, customer_id, barber_id, rating) values (%L, %L, %L, 4)$$,
  tests.id('bk_done'), tests.id('a'), tests.id('x'))), 'ok', 'inv5 allow: the customer reviews the completed booking');
select is(tests.run(tests.id('a'), format($$delete from public.reviews where booking_id = %L$$, tests.id('bk_done'))), '42501',
  'inv5: the author cannot delete the review');
select is(tests.run(tests.id('x'), format($$delete from public.reviews where booking_id = %L$$, tests.id('bk_done'))), '42501',
  'inv5: the barber cannot delete the review');
select is(tests.run(tests.id('a'), format($$update public.reviews set comment = 'changed' where booking_id = %L$$, tests.id('bk_done'))), '42501',
  'inv5: the author cannot edit the review');

-- 6. The booked service belongs to the booked barber ---------------------------
select isnt(tests.run(tests.id('b'), format(
  $$insert into public.bookings (customer_id, barber_id, service_id, date, time, location) values (%L, %L, %L, current_date + 7, '15:00', 'x')$$,
  tests.id('b'), tests.id('x'), tests.id('svc_w'))), 'ok', 'inv6: a direct insert pairing barber X with a service of barber W is refused');
select is((select barber_id from public.bookings where id = tests.id('bk_cancel')), tests.id('x'),
  'inv6 allow: create_booking derives the barber from the service');

-- 7. The booked price never changes --------------------------------------------
select is(tests.run(tests.id('x'), format($$update public.bookings set price = 1 where id = %L$$, tests.id('bk_done'))), '42501',
  'inv7: the barber cannot change the price');
select is(tests.run(tests.id('b'), format($$update public.bookings set price = 1 where id = %L$$, tests.id('bk_cancel'))), '42501',
  'inv7: the customer cannot change the price');
update public.services set price = 99 where id = tests.id('svc_x');
select is((select price from public.bookings where id = tests.id('bk_done')), 35.00::numeric,
  'inv7 allow: a later service price change leaves the snapshot intact');
select throws_ok(format($$update public.bookings set price = 1 where id = %L$$, tests.id('bk_done')), 'P0001', null,
  'inv7: even a table owner write outside service_role is refused by the trigger');

-- 8. Verification status: founders only ----------------------------------------
select is(tests.run(tests.id('y'), format($$update public.barber_profile set verification_status = 'approved' where user_id = %L$$, tests.id('y'))), '42501',
  'inv8: the pending barber cannot approve self');
select is(tests.run(tests.id('x'), format($$update public.barber_profile set verification_status = 'rejected' where user_id = %L$$, tests.id('y'))), '42501',
  'inv8: another barber cannot change it');
select is(tests.run(tests.id('a'), format($$select private.review_barber_verification(%L, 'approved', %L)$$, tests.id('y'), tests.id('a'))), '42501',
  'inv8: a customer cannot call the review action');
select is(tests.run(tests.id('y'), format($$update public.verification_requests set status = 'approved' where user_id = %L$$, tests.id('y'))), '42501',
  'inv8: the barber cannot approve own request row');
select is(tests.affected(tests.id('y'), format($$update public.barber_profile set bio = 'New bio' where user_id = %L$$, tests.id('y'))), 1,
  'inv8 allow: the barber still edits own bio');

-- 9. Storage: verification documents private, portfolio public, six photos ----
select is((select public from storage.buckets where id = 'verification-docs'), false, 'inv9: the verification bucket has no public URL');
select is((select public from storage.buckets where id = 'portfolio'), true, 'inv9 allow: the portfolio bucket is public');
insert into storage.objects (bucket_id, name, owner) values ('verification-docs', tests.id('y') || '/id.jpg', tests.id('y'));
select is(tests.visible(null, 'select 1 from storage.objects where bucket_id = ''verification-docs'''), 0, 'inv9: anon cannot read verification objects');
select is(tests.visible(tests.id('x'), 'select 1 from storage.objects where bucket_id = ''verification-docs'''), 0, 'inv9: another barber sees no verification objects');
select is(tests.visible(tests.id('y'), 'select 1 from storage.objects where bucket_id = ''verification-docs'''), 1, 'inv9 allow: the owner sees own document');
select is(tests.run(tests.id('w'), format($$insert into public.portfolio (barber_id, image_url) values (%L, %L)$$, tests.id('w'), tests.id('w') || '/1.jpg')), 'ok',
  'inv9 allow: a barber adds a portfolio photo');
select is(tests.run(tests.id('w'), format($$insert into public.portfolio (barber_id, image_url) values (%L, %L)$$, tests.id('x'), tests.id('x') || '/1.jpg')), '42501',
  'inv9: a barber cannot add photos to another portfolio');
insert into public.portfolio (barber_id, image_url) select tests.id('w'), tests.id('w') || '/' || n || '.jpg' from generate_series(2, 6) n;
select is(tests.run(tests.id('w'), format($$insert into public.portfolio (barber_id, image_url) values (%L, %L)$$, tests.id('w'), tests.id('w') || '/7.jpg')), 'P0001',
  'inv9: the seventh portfolio photo is refused');

-- 10. Chat rows, read receipts and typing: the two participants only ----------
insert into fx select 'chat_done', id::text from public.chat_rooms where booking_id = tests.id('bk_done');
select is(tests.run(tests.id('x'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'On my way')$$, tests.id('chat_done'), tests.id('x'))), 'ok',
  'inv10 allow: the barber writes in the booking chat');
select is(tests.visible(tests.id('w'), format('select 1 from public.messages where chat_id = %L', tests.id('chat_done'))), 0,
  'inv10: an unrelated barber cannot read the chat');
select is(tests.visible(tests.id('a'), format('select 1 from public.messages where chat_id = %L', tests.id('chat_done'))), 1,
  'inv10 allow: the customer reads the chat');
select is(tests.run(tests.id('a'), format($$insert into public.chat_read_state (chat_id, user_id, last_read_at) values (%L, %L, now())$$, tests.id('chat_done'), tests.id('a'))), 'ok',
  'inv10 allow: the customer stores a read receipt');
select is(tests.visible(tests.id('b'), format('select 1 from public.chat_read_state where chat_id = %L', tests.id('chat_done'))), 0,
  'inv10: another customer cannot read the receipts');
select ok(tests.visible(tests.id('x'), format('select 1 from public.chat_read_state where chat_id = %L', tests.id('chat_done'))) >= 1,
  'inv10 allow: the other participant reads the receipt');
insert into realtime.messages (topic, extension, payload, event, private)
values ('typing:' || tests.id('chat_done'), 'broadcast', '{}', 'typing', true);
select set_config('realtime.topic', 'typing:' || tests.id('chat_done'), true);
select is(tests.visible(tests.id('w'), $$select 1 from realtime.messages where extension = 'broadcast'$$), 0,
  'inv10: an unrelated barber cannot join the typing channel');
select ok(tests.visible(tests.id('a'), $$select 1 from realtime.messages where extension = 'broadcast'$$) >= 1,
  'inv10 allow: the customer joins the typing channel');

select * from finish();
rollback;
