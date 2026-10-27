-- Safety staff alerts (0061): a report or an SOS queues one PII-free push to
-- every staff device; a trip share does not. The transaction never commits,
-- so pg_net never sends the queued requests.
--
-- Run: python tools/db/supa.py test supabase/tests/safety_staff_alerts.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into fx values ('key', gen_random_uuid()::text);
insert into fx select 'bk', tests.scalar(tests.id('a'), format(
  $$select (public.create_booking(%L, current_date + 7, '10:00', 'Customer street 5', %L)).id$$,
  tests.id('svc_x'), tests.id('key')));
insert into fx select 'chat', id::text from public.chat_rooms where booking_id = tests.id('bk');
select is(tests.run(tests.id('x'), format($$insert into public.messages (chat_id, sender_id, message) values (%L, %L, 'hello')$$, tests.id('chat'), tests.id('x'))), 'ok', 'fixture message sent');
insert into fx select 'msg', id::text from public.messages where chat_id = tests.id('chat');

-- Staff member 'b' (not part of the booking) with one German device.
insert into private.safety_staff (user_id) values (tests.id('b')::uuid);
insert into public.push_tokens (token, user_id, platform, language)
values ('ExponentPushToken[staff-test]', tests.id('b')::uuid, 'ios', 'de');

create function tests.staff_pushes() returns bigint language sql as $$
  select count(*) from net.http_request_queue
   where convert_from(body, 'utf8') like '%ExponentPushToken[staff-test]%';
$$;

select is(tests.run(tests.id('a'), format($$insert into public.safety_events (booking_id, user_id, kind) values (%L, %L, 'trip_shared')$$, tests.id('bk'), tests.id('a'))), 'ok', 'a trip share is logged');
select is(tests.staff_pushes(), 0::bigint, 'a trip share does not alert staff');

select is(tests.run(tests.id('a'), format($$insert into public.safety_events (booking_id, user_id, kind) values (%L, %L, 'sos')$$, tests.id('bk'), tests.id('a'))), 'ok', 'an SOS is logged');
select is(tests.staff_pushes(), 1::bigint, 'an SOS alerts staff at once');

select is(tests.run(tests.id('a'), format($$insert into public.user_reports (reporter_id, reported_id, reason, target_type, target_id) values (%L, %L, 'harassment', 'message', %L)$$,
  tests.id('a'), tests.id('x'), tests.id('msg'))), 'ok', 'a report is filed');
select is(tests.staff_pushes(), 2::bigint, 'a report alerts staff');

select ok((select convert_from(body, 'utf8') like '%Neue Meldung%' from net.http_request_queue
            where convert_from(body, 'utf8') like '%ExponentPushToken[staff-test]%' order by id desc limit 1),
  'the alert uses the staff device language');
select ok((select convert_from(body, 'utf8') not like '%hello%' and convert_from(body, 'utf8') not like '%Customer street%'
             from net.http_request_queue
            where convert_from(body, 'utf8') like '%ExponentPushToken[staff-test]%' order by id desc limit 1),
  'the alert carries no message text or address');
select is(tests.visible(tests.id('a'), 'select 1 from private.safety_staff'), -1, 'the staff list is not reachable through the API');

select * from finish();
rollback;
