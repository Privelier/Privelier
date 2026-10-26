-- Abuse limits, content reports and account deletion, with the same
-- synthetic actors and real-role execution as authorization_matrix.test.sql.
-- The transaction never commits.
--
-- Run: python tools/db/supa.py test supabase/tests/abuse_limits_and_account_deletion.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into fx values ('key', gen_random_uuid()::text);
insert into fx select 'bk', tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:00', 'Customer street 5', %L)).id$$,
  tests.id('svc_x'), tests.id('key')));
select ok(tests.id('bk') is not null, 'fixture booking created');
insert into fx select 'chat', id::text from public.chat_rooms where booking_id = tests.id('bk');

-- Repeats one statement as an actor until it is refused: '<attempt>:<sqlstate>' or 'ok'.
create function tests.repeat_until_refused(p_actor uuid, p_sql text, p_times integer) returns text language plpgsql as $$
declare
  v text;
begin
  for i in 1..p_times loop
    v := tests.run(p_actor, replace(p_sql, '{i}', i::text));
    if v <> 'ok' then
      return i || ':' || v;
    end if;
  end loop;
  return 'ok';
end $$;

-- ------------------------------------------------------------ rate limits --
select is(tests.repeat_until_refused(tests.id('x'),
  format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'msg {i}')$$, tests.id('chat'), tests.id('x')), 21),
  '21:PA429', 'the 21st message in a minute is refused');
select is(tests.run(tests.id('a'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'hello')$$, tests.id('chat'), tests.id('a'))),
  'ok', 'paired allow: the message limit is per sender');

-- ---------------------------------------------------------------- reports --
insert into fx select 'msg', id::text from public.messages where sender_id = tests.id('x') and message = 'msg 1';
select is(tests.run(tests.id('a'), format($$insert into public.user_reports (reporter_id, reported_id, reason, target_type, target_id) values (%L, %L, 'harassment', 'message', %L)$$,
  tests.id('a'), tests.id('x'), tests.id('msg'))), 'ok', 'a participant reports a message');
select is((select target_excerpt from public.user_reports where target_id = tests.id('msg')), 'msg 1', 'the reported text is snapshotted for the founders');
select is(tests.run(tests.id('b'), format($$insert into public.user_reports (reporter_id, reported_id, reason, target_type, target_id) values (%L, %L, 'harassment', 'message', %L)$$,
  tests.id('b'), tests.id('x'), tests.id('msg'))), 'P0002', 'nobody can report a message they cannot see');
select is(tests.visible(tests.id('x'), 'select 1 from public.user_reports'), 0, 'the reported person cannot read reports');
select is(tests.visible(tests.id('a'), 'select 1 from public.user_reports'), 1, 'paired allow: the reporter sees own report');
select is(tests.repeat_until_refused(tests.id('a'),
  format($$insert into public.user_reports (reporter_id, reported_id, reason) values (%L, %L, 'other')$$, tests.id('a'), tests.id('x')), 10),
  '10:PA429', 'the 11th report in an hour is refused');

-- ------------------------------------------------------------------- caps --
select is(tests.repeat_until_refused(tests.id('x'),
  format($$insert into public.services (barber_id, name, price, duration_minutes) values (%L, 'S{i}', 10, 30)$$, tests.id('x')), 40),
  '30:PA002', 'a barber can have at most 30 services');
select is(tests.repeat_until_refused(tests.id('x'),
  format($$insert into public.portfolio (barber_id, image_url) values (%L, %L)$$, tests.id('x'), tests.id('x') || '/{i}.jpg'), 10),
  '7:P0001', 'the portfolio stops at six images');
select is(tests.scalar(tests.id('a'),
  format('select count(*) from public.get_booking_counterparts(array(select %L::uuid from generate_series(1, 5000)))', tests.id('bk'))),
  '1', 'RPC id arrays are bounded and still answer');

-- -------------------------------------------------------- account deletion --
insert into public.reviews (booking_id, customer_id, barber_id, rating, comment)
values (tests.id('done'), tests.id('a'), tests.id('x'), 4, 'Personal remark');
select is(tests.run(tests.id('a'), 'select public.delete_own_account()'), 'ok', 'the customer deletes their account');
select ok(not exists (select 1 from auth.users where id = tests.id('a')), 'the auth user is gone');
select ok(not exists (select 1 from public.users where id = tests.id('a')), 'the profile row is gone');
select is((select status::text from public.bookings where id = tests.id('bk')), 'cancelled', 'the future booking was cancelled, not deleted');
select is(tests.visible(tests.id('x'), format('select 1 from public.bookings where id = %L and customer_id is null', tests.id('bk'))), 1,
  'the barber keeps the booking, anonymized');
select ok(tests.visible(tests.id('x'), format('select 1 from public.messages where chat_id = %L and sender_id is null', tests.id('chat'))) >= 1,
  'the barber keeps the conversation, sender anonymized');
select is((select comment from public.reviews where booking_id = tests.id('done')), null, 'the review comment is erased');
select is((select rating from public.reviews where booking_id = tests.id('done')), 4::smallint, 'the star rating stays, so the aggregate is stable');
select ok(exists (select 1 from public.notifications where recipient_id = tests.id('x') and booking_id = tests.id('bk') and booking_status = 'cancelled'),
  'the barber is notified of the cancellation');
select is(tests.run(tests.id('a'), 'select public.delete_own_account()'), 'ok', 'a repeated deletion is a no-op');

select is(tests.run(tests.id('y'), 'select public.delete_own_account()'), 'ok', 'a barber deletes their account');
select ok(not exists (select 1 from public.barber_public_profile where barber_id = tests.id('y')), 'the barber leaves the public projection');

select * from finish();
rollback;
