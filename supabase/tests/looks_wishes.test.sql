-- Looks slice S5 (0067): wishes only from customers with the flag, offers
-- only from approved barbers of the city with proof in the style, inside
-- the window, free (travel buffer included), at the normal service price;
-- accept links a matching normal pending booking; wish notifications carry
-- no booking and never name the client; reports, blocks, expiry, limits and
-- account deletion. Real anon/authenticated roles; never commits.
--
-- Before the migrations are applied (rolled back at the end):
--   python tools/db/supa.py test --with supabase/migrations/0062_feature_flags.sql supabase/migrations/0063_looks_proof_and_match.sql supabase/migrations/0064_looks_reports_and_notifications.sql supabase/migrations/0065_looks_feed_and_reference.sql supabase/migrations/0066_looks_search.sql supabase/migrations/0067_looks_wishes_and_offers.sql -- supabase/tests/looks_wishes.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into fx values ('c', tests.new_user('customer', 'Cem Noflag'));
insert into private.feature_flag_users (flag_key, user_id)
select 'looks', id from (values (tests.id('a')), (tests.id('b')), (tests.id('x')), (tests.id('y'))) v(id);

-- Setup: barber x has confirmed proof in skin_fade (not shown, still proof).
insert into storage.objects (bucket_id, name, owner) values ('looks', tests.id('x') || '/w.jpg', tests.id('x'));
insert into fx select 'look', tests.scalar(tests.id('x'), format($$select (public.create_look_draft(%L, '{skin_fade}', true)).id$$, tests.id('done')));
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/w.jpg')), 'ok', 'setup: photo');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'ok', 'setup: sent');
select is(tests.run(tests.id('a'), format($$select public.respond_to_look(%L, true, false)$$, tests.id('look'))), 'ok', 'setup: confirmed');

-- ------------------------------------------------------------ the wish --
select is(tests.run(null, $$select public.create_wish('skin_fade', current_date + 7, '09:00', '12:00')$$), '42501', 'anon cannot wish');
select is(tests.run(tests.id('c'), $$select public.create_wish('skin_fade', current_date + 7, '09:00', '12:00')$$), '42501', 'flag off: no wish');
select is(tests.run(tests.id('x'), $$select public.create_wish('skin_fade', current_date + 7, '09:00', '12:00')$$), '42501', 'barbers do not wish');
select is(tests.run(tests.id('b'), $$select public.create_wish('skin_fade', current_date + 7, '12:00', '09:00')$$), '22023', 'a reversed window is refused');
select is(tests.run(tests.id('b'), $$select public.create_wish('skin_fade', current_date - 1, '09:00', '12:00')$$), '22023', 'a past day is refused');
select is(tests.run(tests.id('b'), $$select public.create_wish('skin_fade', current_date + 7, '05:00', '18:30')$$), '22023', 'a window over twelve hours is refused');
select is(tests.run(tests.id('b'), $$select public.create_wish('no_such', current_date + 7, '09:00', '12:00')$$), '22023', 'the style must be listed');
select is(tests.run(tests.id('b'), format($$insert into public.look_wishes (customer_id, style, city, day, window_from, window_to, expires_at) values (%L, 'taper', 'teststadt', current_date + 7, '09:00', '10:00', now() + interval '1 hour')$$, tests.id('b'))), '42501', 'wishes are written only through the function');

insert into fx select 'w', tests.scalar(tests.id('b'), $$select (public.create_wish('skin_fade', current_date + 7, '09:00', '12:00')).id$$);
select ok(tests.id('w') is not null, 'paired allow: a customer sends a wish');
select is((select city || ':' || status || ':' || (expires_at <= now() + interval '48 hours')::text from public.look_wishes where id = tests.id('w')), 'teststadt:open:true',
  'the wish keeps the normalized profile city and expires within 48 hours');
select is(tests.visible(tests.id('b'), format('select 1 from public.look_wishes where id = %L', tests.id('w'))), 1, 'the client sees their wish');
select is(tests.visible(tests.id('a'), format('select 1 from public.look_wishes where id = %L', tests.id('w'))), 0, 'nobody else reads the table');

select is((select count(*)::integer from public.notifications where look_wish_id = tests.id('w') and event_type = 'look_wish'
           and recipient_id = tests.id('x') and booking_id is null and actor_id is null), 1,
  'the barber with proof is told, with no booking and no client named');
select is((select count(*)::integer from public.notifications where look_wish_id = tests.id('w') and recipient_id <> tests.id('x')), 0,
  'nobody else is told (pending barber, customers)');

select is(tests.scalar(tests.id('x'), 'select count(*)::text from public.open_wishes()'), '1', 'paired allow: the barber sees the open wish');
select is(tests.scalar(tests.id('y'), 'select count(*)::text from public.open_wishes()'), '0', 'a barber who is not approved and has no proof does not');
select is(tests.scalar(tests.id('a'), 'select count(*)::text from public.open_wishes()'), '0', 'customers do not');
select ok(not exists (
  select 1 from pg_proc p, unnest(p.proargnames) n
  where p.proname in ('open_wishes', 'wish_offers') and n in ('customer_id', 'customer_name', 'city', 'address', 'latitude', 'longitude', 'distance', 'location')
), 'wishes never show the client or a place, offers never a place');

-- --------------------------------------------------------------- offers --
select is(tests.run(tests.id('y'), format($$select public.offer_for_wish(%L, %L, '10:00')$$, tests.id('w'), tests.id('svc_y'))), 'P0002', 'a barber who may not answer cannot offer');
select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '10:00')$$, tests.id('w'), tests.id('svc_y'))), '22023', 'only one of the barber''s own services');
select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '08:00')$$, tests.id('w'), tests.id('svc_x'))), '22023', 'a start before the window is refused');
select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '11:30')$$, tests.id('w'), tests.id('svc_x'))), '22023', 'the service must end inside the window');
select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '10:00', 'you retard')$$, tests.id('w'), tests.id('svc_x'))), 'PA030', 'the note goes through the denylist');
select is(tests.run(tests.id('a'), format($$select public.offer_for_wish(%L, %L, '10:00')$$, tests.id('w'), tests.id('svc_x'))), '42501', 'customers do not offer');

insert into fx select 'o', tests.scalar(tests.id('x'), format($$select (public.offer_for_wish(%L, %L, '10:00', 'Clean fade, see you')).id$$, tests.id('w'), tests.id('svc_x')));
select ok(tests.id('o') is not null, 'paired allow: the barber offers a time in the window');
select is((select count(*)::integer from public.notifications where look_wish_id = tests.id('w') and event_type = 'look_offer'
           and recipient_id = tests.id('b') and actor_id = tests.id('x') and booking_id is null), 1, 'the client is told who offered');
select is(tests.scalar(tests.id('b'), $$select proposed_time::text || ':' || service_price::text || ':' || coalesce(hit_rate::text, 'hidden') || ':' || proof_count from public.wish_offers()$$),
  '10:00:00:35.00:hidden:1', 'the client sees the time, the normal service price, the proof and no rate below the minimum');
select is(tests.scalar(tests.id('a'), 'select count(*)::text from public.wish_offers()'), '0', 'nobody else sees the offers');
select is(tests.visible(tests.id('y'), format('select 1 from public.look_wish_offers where id = %L', tests.id('o'))), 0, 'other barbers cannot read the offer');

select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '09:00')$$, tests.id('w'), tests.id('svc_x'))), 'ok', 'sending again updates the offer');
select is((select count(*)::text || ':' || min(proposed_time)::text from public.look_wish_offers where wish_id = tests.id('w')), '1:09:00:00', 'one offer per barber and wish');
select is((select count(*)::integer from public.notifications where look_wish_id = tests.id('w') and event_type = 'look_offer'), 1, 'an update does not notify again');

insert into fx select 'bk_a', tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '11:00', 'Customer street 5', gen_random_uuid())).id$$, tests.id('svc_x')));
select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '10:00')$$, tests.id('w'), tests.id('svc_x'))), 'PA041', 'a time that hits another booking plus travel time is refused');
select is((select proposed_time::text from public.look_wish_offers where id = tests.id('o')), '09:00:00', 'the earlier offer stands');

-- --------------------------------------------------------------- accept --
insert into fx select 'bk_w', tests.scalar(tests.id('b'), format(
  $$select (public.create_booking(%L, current_date + 7, '09:00', 'Customer street 5', gen_random_uuid())).id$$, tests.id('svc_x')));
insert into fx select 'bk_14', tests.scalar(tests.id('b'), format(
  $$select (public.create_booking(%L, current_date + 7, '14:00', 'Customer street 5', gen_random_uuid())).id$$, tests.id('svc_x')));
select is(tests.run(tests.id('a'), format($$select public.accept_offer(%L, %L)$$, tests.id('o'), tests.id('bk_a'))), 'P0002', 'only the wish''s client accepts');
select is(tests.run(tests.id('b'), format($$select public.accept_offer(%L, %L)$$, tests.id('o'), tests.id('bk_a'))), 'P0002', 'someone else''s booking cannot be linked');
select is(tests.run(tests.id('b'), format($$select public.accept_offer(%L, %L)$$, tests.id('o'), tests.id('bk_14'))), 'P0002', 'a booking at another time cannot be linked');
select is(tests.run(tests.id('b'), format($$select public.accept_offer(%L, %L)$$, tests.id('o'), tests.id('bk_w'))), 'ok', 'paired allow: the matching booking is linked');
select is((select w.status || ':' || (w.booking_id = tests.id('bk_w'))::text || ':' || o.status from public.look_wishes w join public.look_wish_offers o on o.wish_id = w.id where w.id = tests.id('w')),
  'booked:true:accepted', 'the wish is booked and the offer accepted');
select is((select status::text from public.bookings where id = tests.id('bk_w')), 'pending', 'the booking stays a normal pending request the barber confirms (L3)');
select is((select style || ':' || coalesce(look_id::text, 'none') from public.look_references where booking_id = tests.id('bk_w')), 'skin_fade:none', 'the wish style rides along as the reference');
select is(tests.run(tests.id('b'), format($$select public.accept_offer(%L, %L)$$, tests.id('o'), tests.id('bk_w'))), 'P0002', 'an offer is accepted once');
select is(tests.scalar(tests.id('x'), 'select count(*)::text from public.open_wishes()'), '0', 'a booked wish leaves the barber''s list');
select is(tests.run(tests.id('b'), format($$select public.cancel_wish(%L)$$, tests.id('w'))), 'P0002', 'a booked wish cannot be cancelled');

-- ------------------------------------------------- photo, block, expiry --
select is(tests.run(tests.id('b'), format($$insert into storage.objects (bucket_id, name, owner) values ('look-references', %L, %L)$$, tests.id('b') || '/wish.jpg', tests.id('b'))), 'ok', 'setup: the client uploads a reference photo');
select is(tests.run(tests.id('b'), format($$select public.create_wish('skin_fade', current_date + 7, '15:00', '18:00', %L)$$, tests.id('a') || '/x.jpg')), '22023', 'only the client''s own photo');
insert into fx select 'w3', tests.scalar(tests.id('b'), format($$select (public.create_wish('skin_fade', current_date + 7, '15:00', '18:00', %L)).id$$, tests.id('b') || '/wish.jpg'));
select is(tests.visible(tests.id('x'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/wish.jpg')), 1, 'a barber who may answer can open the wish photo');
select is(tests.visible(tests.id('y'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/wish.jpg')), 0, 'another barber cannot');
select is(tests.visible(tests.id('a'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/wish.jpg')), 0, 'another customer cannot');

select is(tests.run(tests.id('b'), format($$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$$, tests.id('b'), tests.id('x'))), 'ok', 'b blocks the barber');
select is(tests.scalar(tests.id('x'), 'select count(*)::text from public.open_wishes()'), '0', 'no wish across a block');
select is(tests.visible(tests.id('x'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/wish.jpg')), 0, 'and no photo');
delete from public.user_blocks where blocker_id = tests.id('b');

select is(tests.run(tests.id('b'), format($$select public.cancel_wish(%L)$$, tests.id('w3'))), 'ok', 'the client cancels a wish');
select is(tests.visible(tests.id('x'), format($$select 1 from storage.objects where bucket_id = 'look-references' and name = %L$$, tests.id('b') || '/wish.jpg')), 0, 'photo access ends with the wish');

insert into fx select 'w4', tests.scalar(tests.id('b'), $$select (public.create_wish('skin_fade', current_date + 7, '12:00', '15:00')).id$$);
update public.look_wishes set expires_at = now() - interval '1 minute' where id = tests.id('w4');
select is(tests.scalar(tests.id('x'), 'select count(*)::text from public.open_wishes()'), '0', 'an expired wish leaves the list (computed on read, no job)');
select is(tests.run(tests.id('x'), format($$select public.offer_for_wish(%L, %L, '12:30')$$, tests.id('w4'), tests.id('svc_x'))), 'P0002', 'and takes no offer');

-- ------------------------------------------------------ withdraw, limits --
insert into fx select 'w5', tests.scalar(tests.id('b'), $$select (public.create_wish('skin_fade', current_date + 7, '12:00', '15:00')).id$$);
insert into fx select 'o5', tests.scalar(tests.id('x'), format($$select (public.offer_for_wish(%L, %L, '12:30')).id$$, tests.id('w5'), tests.id('svc_x')));
select ok(tests.id('o5') is not null, 'setup: an offer between two bookings and their travel time');
select is(tests.run(tests.id('y'), format($$select public.withdraw_offer(%L)$$, tests.id('o5'))), 'P0002', 'only the offering barber withdraws');
select is(tests.run(tests.id('x'), format($$select public.withdraw_offer(%L)$$, tests.id('o5'))), 'ok', 'the barber withdraws');
select is(tests.scalar(tests.id('b'), format('select count(*)::text from public.wish_offers(%L)', tests.id('w5'))), '0', 'a withdrawn offer is not bookable');

insert into fx select 'w6', tests.scalar(tests.id('b'), $$select (public.create_wish('taper', current_date + 8, '09:00', '12:00')).id$$);
insert into fx select 'w7', tests.scalar(tests.id('b'), $$select (public.create_wish('crop', current_date + 8, '09:00', '12:00')).id$$);
select is(tests.run(tests.id('b'), $$select public.create_wish('buzz', current_date + 8, '09:00', '12:00')$$), 'PA002', 'at most three open wishes (expired and cancelled ones do not count)');

-- -------------------------------------------------------------- reports --
select is(tests.run(tests.id('b'), format($$insert into public.user_reports (reporter_id, reported_id, target_type, target_id, reason) values (%L, null, 'offer', %L, 'inappropriate_content')$$, tests.id('b'), tests.id('o'))), 'ok', 'the client reports an offer');
select is((select reported_id from public.user_reports where target_type = 'offer' and target_id = tests.id('o')), tests.id('x'), 'the report names the barber');
select is(tests.run(tests.id('a'), format($$insert into public.user_reports (reporter_id, reported_id, target_type, target_id, reason) values (%L, null, 'offer', %L, 'inappropriate_content')$$, tests.id('a'), tests.id('o'))), 'P0002', 'an offer to someone else cannot be reported');
select is(tests.run(tests.id('x'), format($$insert into public.user_reports (reporter_id, reported_id, target_type, target_id, reason) values (%L, null, 'wish', %L, 'inappropriate_content')$$, tests.id('x'), tests.id('w5'))), 'ok', 'a barber who may answer reports a wish');
select is(tests.run(tests.id('y'), format($$insert into public.user_reports (reporter_id, reported_id, target_type, target_id, reason) values (%L, null, 'wish', %L, 'inappropriate_content')$$, tests.id('y'), tests.id('w5'))), 'P0002', 'a wish nobody showed you cannot be reported');

-- ---------------------------------------------- notifications, deletion --
select is(tests.run(null, format($$insert into public.notifications (recipient_id, event_type, booking_id, actor_id, event_key) values (%L, 'new_request', null, %L, 'probe')$$, tests.id('x'), tests.id('b'))), '42501', 'anon writes no notification');
select throws_ok(format($$insert into public.notifications (recipient_id, event_type, booking_id, actor_id, event_key) values (%L, 'new_request', null, %L, 'probe')$$, tests.id('x'), tests.id('b')),
  '23514', null, 'every booking event still needs its booking');
select is(tests.run(tests.id('b'), 'select public.delete_own_account()'), 'ok', 'the client deletes their account');
select is((select count(*)::integer from public.look_wishes where customer_id = tests.id('b')), 0, 'their wishes go');
select is((select count(*)::integer from public.notifications where look_wish_id is not null), 0, 'with their offers and wish notifications');

select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute no public function');

select * from finish();
rollback;
