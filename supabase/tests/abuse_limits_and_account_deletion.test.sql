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

-- ------------------------------------------------- request write limiter --
-- PostgREST calls private.limit_api_writes() before every request with the
-- request method, headers and JWT claims set; reproduce that here.
create function tests.api_writes(p_actor uuid, p_method text, p_role text, p_times integer) returns text language plpgsql as $$
declare
  v_state text;
  v_detail text;
begin
  for i in 1..p_times loop
    begin
      perform set_config('request.method', p_method, true);
      perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', true);
      perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', p_role)::text, true);
      perform private.limit_api_writes();
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_detail = pg_exception_detail;
      perform set_config('request.jwt.claims', '', true);
      return i || ':' || v_state || ':' || coalesce(v_detail::json ->> 'status', '');
    end;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return 'ok';
end $$;
select is(tests.api_writes(tests.id('b'), 'GET', 'authenticated', 300), 'ok', 'reads are never counted');
select is(tests.api_writes(tests.id('b'), 'POST', 'authenticated', 121), '121:PGRST:429', 'the 121st write in a minute answers HTTP 429');
select is(tests.api_writes(tests.id('x'), 'POST', 'service_role', 300), 'ok', 'trusted server jobs are not rate limited');
select ok(exists (
  select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
  where r.rolname = 'authenticator' and 'pgrst.db_pre_request=private.limit_api_writes' = any(s.setconfig)
), 'PostgREST is configured to call the limiter');

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

-- Caps: fill to the limit as the table owner, then one more as the user.
insert into public.availability (barber_id, day_of_week, start_time, end_time)
select tests.id('x'), (n % 7)::smallint, '06:00', '07:00' from generate_series(1, 59) n;
select is(tests.run(tests.id('x'), format($$insert into public.availability (barber_id, day_of_week, start_time, end_time) values (%L, 1, '20:00', '21:00')$$, tests.id('x'))),
  'PA002', 'a barber can have at most 60 availability windows');

insert into public.barber_days_off (barber_id, day)
select tests.id('x'), current_date + n from generate_series(10, 409) n;
select is(tests.run(tests.id('x'), format($$insert into public.barber_days_off (barber_id, day) values (%L, current_date + 500)$$, tests.id('x'))),
  'PA002', 'days off are capped at 400');

create function tests.many_barbers(p_count integer) returns uuid[] language plpgsql as $$
declare
  ids uuid[] := array(select gen_random_uuid() from generate_series(1, p_count));
begin
  insert into auth.users (id, email) select id, id || '@test.privelier.invalid' from unnest(ids) id;
  insert into public.users (id, name, email, role) select id, 'Filler', id || '@test.privelier.invalid', 'barber' from unnest(ids) id;
  insert into public.barber_profile (user_id, verification_status) select id, 'approved' from unnest(ids) id;
  return ids;
end $$;
insert into fx select 'b' || ord, id::text from unnest(tests.many_barbers(201)) with ordinality as t(id, ord);
insert into public.customer_favorites (customer_id, barber_id)
select tests.id('b'), v::uuid from fx where k ~ '^b[0-9]+$' and substr(k, 2)::integer <= 200;
select is(tests.run(tests.id('b'), format($$insert into public.customer_favorites (customer_id, barber_id) values (%L, %L)$$, tests.id('b'), tests.id('b201'))),
  'PA002', 'a customer can keep at most 200 favorites');

select is(tests.repeat_until_refused(tests.id('a'),
  $$insert into public.user_blocks (blocker_id, blocked_id) select tests.id('a'), tests.id('b' || ({i} + 100))$$, 31),
  '31:PA429', 'the 31st block in an hour is refused');

select is(tests.repeat_until_refused(tests.id('a'),
  format($$insert into public.safety_events (booking_id, user_id, kind) values (%L, %L, 'sos')$$, tests.id('bk'), tests.id('a')), 31),
  '31:PA429', 'the 31st safety event in an hour is refused');

insert into storage.objects (bucket_id, name, owner)
select 'verification-docs', tests.id('y') || '/doc-' || n || '.jpg', tests.id('y') from generate_series(1, 10) n;
select is(tests.run(tests.id('y'), format($$insert into storage.objects (bucket_id, name, owner) values ('verification-docs', %L, %L)$$, tests.id('y') || '/doc-11.jpg', tests.id('y'))),
  '42501', 'a barber can park at most 10 verification files');
insert into storage.objects (bucket_id, name, owner)
select 'portfolio', tests.id('x') || '/p-' || n || '.jpg', tests.id('x') from generate_series(1, 12) n;
select is(tests.run(tests.id('x'), format($$insert into storage.objects (bucket_id, name, owner) values ('portfolio', %L, %L)$$, tests.id('x') || '/p-13.jpg', tests.id('x'))),
  '42501', 'a barber can park at most 12 portfolio files');

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
