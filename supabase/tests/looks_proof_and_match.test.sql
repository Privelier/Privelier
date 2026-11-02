-- Looks slice S2 (0063, 0064): proof looks, look match, the private photo
-- bucket, look reports, the look_confirm notification and account deletion.
-- Every deny has a paired allow. Runs as the real anon/authenticated roles
-- with JWT claims; synthetic users only; the transaction never commits.
--
-- Before the migrations are applied (rolled back at the end):
--   python tools/db/supa.py test --with supabase/migrations/0062_feature_flags.sql supabase/migrations/0063_looks_proof_and_match.sql supabase/migrations/0064_looks_reports_and_notifications.sql -- supabase/tests/looks_proof_and_match.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

-- ------------------------------------------------------------ flag off --
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{skin_fade}', true)$$, tests.id('done'))), '42501', 'flag off: a barber cannot capture a look');
select is(tests.visible(tests.id('a'), 'select 1 from public.look_styles'), 0, 'flag off: styles are not readable');
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_look_stats(%L)', tests.id('x'))), 0, 'flag off: no stats');

insert into private.feature_flag_users (flag_key, user_id)
select 'looks', id from (values (tests.id('a')), (tests.id('b')), (tests.id('x')), (tests.id('y'))) v(id);
select is(tests.visible(tests.id('a'), 'select 1 from public.look_styles'), 9, 'paired allow: flag on, the nine styles are readable');

-- ------------------------------------------------------- capture rules --
select is(tests.run(null, format($$select public.create_look_draft(%L, '{skin_fade}', true)$$, tests.id('done'))), '42501', 'anon cannot capture a look');
select is(tests.run(tests.id('a'), format($$select public.create_look_draft(%L, '{skin_fade}', true)$$, tests.id('done'))), '42501', 'a customer cannot capture a look');
select is(tests.run(tests.id('y'), format($$select public.create_look_draft(%L, '{skin_fade}', true)$$, tests.id('done'))), 'P0002', 'another barber cannot capture a look for this booking');
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{}', true)$$, tests.id('done'))), '22023', 'at least one style');
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{no_such_style}', true)$$, tests.id('done'))), '22023', 'only listed styles');
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{skin_fade,taper,crop,buzz}', true)$$, tests.id('done'))), '22023', 'at most three styles');
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{taper,taper}', true)$$, tests.id('done'))), '22023', 'no duplicate styles');
insert into fx select 'look', tests.scalar(tests.id('x'), format($$select (public.create_look_draft(%L, '{skin_fade}', false)).id$$, tests.id('done')));
select ok(tests.id('look') is not null, 'paired allow: the barber captures a draft for a completed booking');
select is(tests.visible(tests.id('a'), format('select 1 from public.looks where id = %L', tests.id('look'))), 0, 'the customer does not see a draft before it is sent');
select is(tests.visible(tests.id('x'), format('select 1 from public.looks where id = %L', tests.id('look'))), 1, 'paired allow: the barber sees the draft');

-- A pending (not completed) booking cannot carry a look.
alter table public.bookings disable trigger trg_validate_booking_slot;
insert into public.bookings (customer_id, barber_id, service_id, date, time, location, status)
values (tests.id('b'), tests.id('x'), tests.id('svc_x'), current_date - 3, '09:00', 'Elsewhere 2', 'accepted');
alter table public.bookings enable trigger trg_validate_booking_slot;
insert into fx select 'accepted', id::text from public.bookings where customer_id = tests.id('b') and status = 'accepted';
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{taper}', true)$$, tests.id('accepted'))), 'P0002', 'an accepted booking cannot carry a look');

-- ------------------------------------------------------------- photos --
select is(tests.run(tests.id('x'), format($$insert into storage.objects (bucket_id, name, owner) values ('looks', %L, %L)$$, tests.id('x') || '/one.jpg', tests.id('x'))), 'ok', 'the barber uploads into their own looks folder');
select is(tests.run(tests.id('a'), format($$insert into storage.objects (bucket_id, name, owner) values ('looks', %L, %L)$$, tests.id('x') || '/fake.jpg', tests.id('a'))), '42501', 'nobody uploads into another folder');
select is(tests.run(tests.id('b'), format($$insert into storage.objects (bucket_id, name, owner) values ('looks', %L, %L)$$, tests.id('b') || '/mine.jpg', tests.id('b'))), '42501', 'customers cannot upload look photos');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'P0001', 'a look without a photo cannot be sent');
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/missing.jpg')), '22023', 'a photo must be uploaded first');
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('y') || '/one.jpg')), '22023', 'a photo must sit in the barber''s own folder');
select is(tests.run(tests.id('a'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/one.jpg')), 'P0002', 'the customer cannot add photos');
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/one.jpg')), 'ok', 'paired allow: the barber attaches the uploaded photo');
insert into storage.objects (bucket_id, name, owner) values
  ('looks', tests.id('x') || '/two.jpg', tests.id('x')),
  ('looks', tests.id('x') || '/three.jpg', tests.id('x')),
  ('looks', tests.id('x') || '/four.jpg', tests.id('x'));
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/two.jpg')), 'ok', 'second photo');
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/three.jpg')), 'ok', 'third photo');
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/four.jpg')), 'PA002', 'at most three photos per look');
select is(tests.run(tests.id('x'), format($$select public.remove_look_photo(id) from public.look_photos where storage_path = %L$$, tests.id('x') || '/three.jpg')), 'ok', 'the barber removes a draft photo');

select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'P0001', 'a look is not sent before "no face visible" is confirmed');
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{skin_fade,taper}', true)$$, tests.id('done'))), 'ok', 'the barber edits the draft and confirms no face');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'ok', 'paired allow: the look is sent');
select is(tests.run(tests.id('x'), format($$select public.create_look_draft(%L, '{crop}', true)$$, tests.id('done'))), 'P0001', 'a sent look cannot be edited');
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/four.jpg')), 'P0002', 'a sent look takes no more photos');

-- ------------------------------------------------- notification, reads --
select is(tests.visible(tests.id('a'), format($$select 1 from public.notifications where event_type = 'look_confirm' and booking_id = %L$$, tests.id('done'))), 1, 'the customer is asked "Is this your cut?"');
select is(tests.visible(tests.id('a'), format('select 1 from public.looks where id = %L', tests.id('look'))), 1, 'the customer sees the sent look');
select is(tests.visible(tests.id('a'), format('select 1 from public.look_photos where look_id = %L', tests.id('look'))), 2, 'and its two photos');
select is(tests.visible(tests.id('b'), format('select 1 from public.looks where id = %L', tests.id('look'))), 0, 'another customer cannot read the look');
select is(tests.visible(tests.id('b'), format('select 1 from public.look_photos where look_id = %L', tests.id('look'))), 0, 'or its photo rows');
select is(tests.visible(tests.id('a'), format($$select 1 from storage.objects where bucket_id = 'looks' and name = %L$$, tests.id('x') || '/one.jpg')), 1, 'the customer can open the photo file');
select is(tests.visible(tests.id('b'), format($$select 1 from storage.objects where bucket_id = 'looks' and name = %L$$, tests.id('x') || '/one.jpg')), 0, 'another customer cannot open it');
select is(tests.visible(tests.id('y'), $$select 1 from storage.objects where bucket_id = 'looks'$$), 0, 'another barber cannot list the bucket');
select is(tests.run(tests.id('x'), format($$update public.looks set status = 'published' where id = %L$$, tests.id('look'))), '42501', 'nobody writes looks directly');

-- -------------------------------------------------------------- answers --
select is(tests.run(tests.id('b'), format($$select public.respond_to_look(%L, true, true)$$, tests.id('look'))), 'P0001', 'only the look''s customer answers');
select is(tests.run(tests.id('a'), format($$select public.respond_to_look(%L, true, true)$$, tests.id('look'))), 'ok', 'paired allow: the customer confirms and consents to show');
select is((select status || ':' || consent_version from public.looks where id = tests.id('look')), 'published:looks-placeholder-1', 'consent is stored with its version');
select is(tests.run(tests.id('a'), format($$select public.respond_to_look(%L, false, false)$$, tests.id('look'))), 'P0001', 'an answer cannot be changed by answering again');
select is(tests.run(tests.id('x'), format($$select public.withdraw_look(%L, 'hide')$$, tests.id('look'))), 'P0002', 'only the customer hides a look');
select is(tests.run(tests.id('a'), format($$select public.withdraw_look(%L, 'hide')$$, tests.id('look'))), 'ok', 'paired allow: the customer stops showing it');
select is((select status from public.looks where id = tests.id('look')), 'confirmed', 'a hidden look still counts as confirmed');
select is(tests.scalar(tests.id('a'), format('select private.can_remove_look_photo(%L)::text', tests.id('x') || '/one.jpg')), 'true', 'the customer may remove the files of a look they do not show');
select is(tests.scalar(tests.id('b'), format('select private.can_remove_look_photo(%L)::text', tests.id('x') || '/one.jpg')), 'false', 'nobody else may');

-- ------------------------------------------------------------- reports --
select is(tests.run(tests.id('b'), format($$insert into public.user_reports (reporter_id, reported_id, target_type, target_id, reason) values (%L, null, 'look', %L, 'inappropriate_content')$$, tests.id('b'), tests.id('look'))), 'P0002', 'a look nobody showed you cannot be reported');
select is(tests.run(tests.id('a'), format($$insert into public.user_reports (reporter_id, reported_id, target_type, target_id, reason) values (%L, null, 'look', %L, 'inappropriate_content')$$, tests.id('a'), tests.id('look'))), 'ok', 'paired allow: the customer reports their look');
select is((select reported_id from public.user_reports where target_type = 'look' and target_id = tests.id('look')), tests.id('x'), 'the report names the barber who captured it');

-- ----------------------------------------------------------- look match --
select is(tests.run(tests.id('b'), format($$select public.submit_look_feedback(%L, 'skin_fade', 'exact')$$, tests.id('done'))), 'P0002', 'only the booking''s customer rates the look');
select is(tests.run(tests.id('x'), format($$select public.submit_look_feedback(%L, 'skin_fade', 'exact')$$, tests.id('done'))), '42501', 'a barber cannot rate their own look');
select is(tests.run(tests.id('a'), format($$select public.submit_look_feedback(%L, 'skin_fade', 'perfect')$$, tests.id('done'))), '22023', 'only exact, close or miss');
select is(tests.run(tests.id('a'), format($$select public.submit_look_feedback(%L, 'no_such_style', 'exact')$$, tests.id('done'))), '22023', 'only listed styles');
select is(tests.run(tests.id('a'), format($$select public.submit_look_feedback(%L, 'skin_fade', 'exact')$$, tests.id('done'))), 'ok', 'paired allow: the customer rates the look');
select is(tests.run(tests.id('a'), format($$select public.submit_look_feedback(%L, 'skin_fade', 'miss')$$, tests.id('done'))), '23505', 'one verdict per booking');
select is(tests.run(tests.id('a'), format($$insert into public.look_feedback (booking_id, barber_id, customer_id, style, verdict) values (%L, %L, %L, 'taper', 'exact')$$, tests.id('accepted'), tests.id('x'), tests.id('a'))), '42501', 'nobody writes verdicts directly');
select is(tests.visible(tests.id('a'), 'select 1 from public.look_feedback'), 1, 'the customer reads back their verdict');
select is(tests.visible(tests.id('x'), 'select 1 from public.look_feedback'), 0, 'the barber never sees single verdicts');

select is(tests.scalar(tests.id('b'), format($$select feedback_count || ':' || coalesce(hit_rate::text, 'hidden') || ':' || proof_count from public.barber_look_stats(%L) where style = 'skin_fade'$$, tests.id('x'))),
  '1:hidden:1', 'below the minimum count the hit rate stays hidden');
update private.looks_settings set min_feedback_for_rate = 1;
select is(tests.scalar(tests.id('b'), format($$select hit_rate::text from public.barber_look_stats(%L) where style = 'skin_fade'$$, tests.id('x'))),
  '1.00', 'at the minimum the exact-only hit rate shows');
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_look_stats(%L)', tests.id('y'))), 0, 'a pending barber has no public stats');
select is(tests.run(tests.id('x'), format($$select public.withdraw_look(%L, 'withdraw')$$, tests.id('look'))), 'ok', 'the barber withdraws the look');
select is(tests.scalar(tests.id('b'), format($$select proof_count::text from public.barber_look_stats(%L) where style = 'skin_fade'$$, tests.id('x'))), '0', 'a withdrawn look is no longer proof');
select is(tests.run(tests.id('a'), format($$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$$, tests.id('a'), tests.id('x'))), 'ok', 'the customer blocks the barber');
select is(tests.visible(tests.id('a'), format('select 1 from public.barber_look_stats(%L)', tests.id('x'))), 0, 'no stats across a block');
select ok(tests.visible(tests.id('b'), format('select 1 from public.barber_look_stats(%L)', tests.id('x'))) >= 1, 'paired allow: others still see them');

-- -------------------------------------------------------- flag removed --
delete from private.feature_flag_users where user_id = tests.id('b');
select is(tests.visible(tests.id('b'), format('select 1 from public.barber_look_stats(%L)', tests.id('x'))), 0, 'turning the flag off hides stats again');
insert into private.feature_flag_users (flag_key, user_id) values ('looks', tests.id('b'));

-- ----------------------------------------------------- account deletion --
alter table public.bookings disable trigger trg_validate_booking_slot;
insert into public.bookings (customer_id, barber_id, service_id, date, time, location, status)
values (tests.id('b'), tests.id('x'), tests.id('svc_x'), current_date - 2, '15:00', 'Elsewhere 3', 'completed');
alter table public.bookings enable trigger trg_validate_booking_slot;
insert into fx select 'done_b', id::text from public.bookings where customer_id = tests.id('b') and status = 'completed';
insert into storage.objects (bucket_id, name, owner) values ('looks', tests.id('x') || '/b.jpg', tests.id('x'));
insert into fx select 'look_b', tests.scalar(tests.id('x'), format($$select (public.create_look_draft(%L, '{crop}', true)).id$$, tests.id('done_b')));
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look_b'), tests.id('x') || '/b.jpg')), 'ok', 'setup: photo for the second look');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look_b'))), 'ok', 'setup: second look sent');
select is(tests.run(tests.id('b'), format($$select public.respond_to_look(%L, true, true)$$, tests.id('look_b'))), 'ok', 'setup: second customer publishes');
select is(tests.run(tests.id('b'), format($$select public.submit_look_feedback(%L, 'crop', 'close')$$, tests.id('done_b'))), 'ok', 'setup: second customer rates');
select is(tests.run(tests.id('b'), 'select public.delete_own_account()'), 'ok', 'the second customer deletes their account');
select is((select count(*)::integer from public.looks where id = tests.id('look_b')), 0, 'their look is gone with the account');
select is((select count(*)::integer from public.look_photos p where p.storage_path = tests.id('x') || '/b.jpg'), 0, 'and its photo rows (files: delete-account function)');
select is((select coalesce(customer_id::text, 'null') from public.look_feedback where booking_id = tests.id('done_b')), 'null', 'their verdict stays for the barber''s rate, without the customer');

-- ------------------------------------------------------- database hygiene --
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
           and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute no public function');
select ok(not exists (
  select 1 from storage.buckets where id = 'looks'
    and (public or file_size_limit is null or allowed_mime_types is null)
), 'the looks bucket is private with a size limit and an image-only MIME list');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, 'RLS is enabled on every public table');

select * from finish();
rollback;
