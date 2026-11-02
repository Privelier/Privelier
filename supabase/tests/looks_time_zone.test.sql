-- Looks on the same clock as bookings (0071): match_look, offer_for_wish and
-- wish_offers follow the barber's time zone like create_booking (0069),
-- create_wish follows the customer's. Every slot is chosen so the old UTC
-- comparison gives the opposite answer. Real anon/authenticated roles; never
-- commits.
--
-- Before 0071 is applied (rolled back at the end):
--   python tools/db/supa.py test --with supabase/migrations/0071_looks_barber_time_zone.sql -- supabase/tests/looks_time_zone.test.sql
-- Afterwards:
--   python tools/db/supa.py test supabase/tests/looks_time_zone.test.sql
begin;
select * from no_plan();

\ir _fixtures.psql

insert into private.feature_flag_users (flag_key, user_id)
select 'looks', id from (values (tests.id('a')), (tests.id('b')), (tests.id('x'))) v(id);

-- Setup: barber x has confirmed proof in skin_fade with the 60-minute service.
insert into storage.objects (bucket_id, name, owner) values ('looks', tests.id('x') || '/t.jpg', tests.id('x'));
insert into fx select 'look', tests.scalar(tests.id('x'), format($$select (public.create_look_draft(%L, '{skin_fade}', true)).id$$, tests.id('done')));
select is(tests.run(tests.id('x'), format($$select public.add_look_photo(%L, %L)$$, tests.id('look'), tests.id('x') || '/t.jpg')), 'ok', 'setup: photo');
select is(tests.run(tests.id('x'), format($$select public.submit_look(%L)$$, tests.id('look'))), 'ok', 'setup: sent');
select is(tests.run(tests.id('a'), format($$select public.respond_to_look(%L, true, false)$$, tests.id('look'))), 'ok', 'setup: confirmed');

-- Two wall-clock starts, valid at any hour of the day (a window of 90 minutes
-- never crosses midnight):
--   ahead:  1 to 3 hours ahead in UTC. Past at UTC+14, future at UTC-12.
--   behind: 2 to 3 hours behind UTC. The old UTC check calls it past, but it
--           is still ahead at UTC-12.
insert into fx select 'ahead', (case
  when extract(hour from now() at time zone 'UTC') >= 21 then date_trunc('day', now() at time zone 'UTC') + interval '1 day'
  else date_trunc('hour', now() at time zone 'UTC') + interval '2 hours' end)::text;
insert into fx select 'behind', (case
  when extract(hour from now() at time zone 'UTC') = 1 then date_trunc('hour', now() at time zone 'UTC') - interval '3 hours'
  else date_trunc('hour', now() at time zone 'UTC') - interval '2 hours' end)::text;

create function tests.day_of(p_key text) returns date language sql stable as $$ select v::timestamp::date from fx where k = p_key $$;
create function tests.time_of(p_key text) returns time language sql stable as $$ select v::timestamp::time from fx where k = p_key $$;
create function tests.set_zone(p_user uuid, p_zone text) returns void language sql as $$ update public.users set time_zone = p_zone where id = p_user $$;

-- The first free start match_look offers with barber x for one of the slots.
create function tests.first_free(p_customer uuid, p_key text) returns text language sql as $$
  select tests.scalar(p_customer, format(
    $q$select coalesce(max(first_free_time)::text, 'none') from public.match_look('skin_fade', %L, %L, %L) where barber_id = %L$q$,
    tests.day_of(p_key), tests.time_of(p_key), tests.time_of(p_key) + interval '90 minutes', tests.id('x')));
$$;

-- A wish for one of the slots, as a statement.
create function tests.wish_sql(p_key text) returns text language sql as $$
  select format($q$select public.create_wish('skin_fade', %L, %L, %L)$q$,
    tests.day_of(p_key), tests.time_of(p_key), tests.time_of(p_key) + interval '90 minutes');
$$;

create function tests.wish_id(p_customer uuid, p_key text) returns text language sql as $$
  select w.id::text from public.look_wishes w
  where w.customer_id = p_customer and w.day = tests.day_of(p_key) and w.window_from = tests.time_of(p_key);
$$;

create function tests.offer_sql(p_wish text, p_key text) returns text language sql as $$
  select format($q$select public.offer_for_wish(%L, %L, %L)$q$, p_wish, tests.id('svc_x'), tests.time_of(p_key));
$$;

insert into public.availability (barber_id, specific_date, start_time, end_time)
select distinct tests.id('x'), d, time '00:00', time '23:59:59'
from (values (tests.day_of('ahead')), (tests.day_of('behind'))) v(d);

-- ---------------------------------------------------------- match_look --
select tests.set_zone(tests.id('x'), 'Etc/GMT-14');
select is(tests.first_free(tests.id('b'), 'ahead'), 'none',
  'match_look: a start already past for the barber at UTC+14 is not offered, though it is ahead in UTC');
select tests.set_zone(tests.id('x'), 'Etc/GMT+12');
select is(tests.first_free(tests.id('b'), 'ahead'), tests.time_of('ahead')::text,
  'paired allow: the same start is offered for a barber at UTC-12');
select is(tests.first_free(tests.id('b'), 'behind'), tests.time_of('behind')::text,
  'match_look: a start ahead for the barber at UTC-12 is offered, though it is past in UTC');

-- The 30 search days count from the barber's today.
insert into fx select 'barber_today', ((now() at time zone 'Etc/GMT+12')::date)::text;
insert into public.availability (barber_id, specific_date, start_time, end_time)
select tests.id('x'), (select v::date from fx where k = 'barber_today') + n, time '09:00', time '18:00' from (values (30), (31)) v(n);
select is(tests.scalar(tests.id('b'), format($q$select count(*)::text from public.match_look('skin_fade', %L, '09:00', '12:00') where barber_id = %L$q$,
  (select v::date from fx where k = 'barber_today') + 30, tests.id('x'))), '1', 'match_look: day 30 on the barber''s calendar is searchable');
select is(tests.scalar(tests.id('b'), format($q$select count(*)::text from public.match_look('skin_fade', %L, '09:00', '12:00') where barber_id = %L$q$,
  (select v::date from fx where k = 'barber_today') + 31, tests.id('x'))), '0', 'match_look: day 31 on the barber''s calendar is not');

-- ------------------------------------------ offer_for_wish, wish_offers --
-- Customer b is at UTC-12, so both slots are still ahead for the wish itself.
select tests.set_zone(tests.id('b'), 'Etc/GMT+12');
select is(tests.run(tests.id('b'), tests.wish_sql('ahead')), 'ok', 'setup: a wish for the slot ahead in UTC');

select tests.set_zone(tests.id('x'), 'Etc/GMT-14');
select is(tests.run(tests.id('x'), tests.offer_sql(tests.wish_id(tests.id('b'), 'ahead'), 'ahead')), 'PA041',
  'offer_for_wish: a start already past for the barber at UTC+14 is refused, though it is ahead in UTC');
select tests.set_zone(tests.id('x'), 'Etc/GMT+12');
select is(tests.run(tests.id('x'), tests.offer_sql(tests.wish_id(tests.id('b'), 'ahead'), 'ahead')), 'ok',
  'paired allow: the same offer goes through for a barber at UTC-12');

select is(tests.scalar(tests.id('b'), format('select count(*)::text from public.wish_offers(%L)', tests.wish_id(tests.id('b'), 'ahead'))), '1',
  'wish_offers: the customer sees an offer still ahead for the barber');
select tests.set_zone(tests.id('x'), 'Etc/GMT-14');
select is(tests.scalar(tests.id('b'), format('select count(*)::text from public.wish_offers(%L)', tests.wish_id(tests.id('b'), 'ahead'))), '0',
  'wish_offers: an offer whose start passed for the barber at UTC+14 is gone, though it is ahead in UTC');
select tests.set_zone(tests.id('x'), 'Etc/GMT+12');

select is(tests.run(tests.id('b'), tests.wish_sql('behind')), 'ok',
  'create_wish: a window ahead for the customer at UTC-12 is taken, though it is past in UTC');
select is(tests.run(tests.id('x'), tests.offer_sql(tests.wish_id(tests.id('b'), 'behind'), 'behind')), 'ok',
  'offer_for_wish: a start ahead for the barber at UTC-12 is taken, though it is past in UTC');
select is(tests.scalar(tests.id('b'), format('select count(*)::text from public.wish_offers(%L)', tests.wish_id(tests.id('b'), 'behind'))), '1',
  'wish_offers: that offer is shown, though its start is past in UTC');

-- --------------------------------------------------------- create_wish --
select tests.set_zone(tests.id('a'), 'Etc/GMT-14');
select is(tests.run(tests.id('a'), tests.wish_sql('ahead')), '22023',
  'create_wish: a window already begun for the customer at UTC+14 is refused, though it is ahead in UTC');
select tests.set_zone(tests.id('a'), 'Etc/GMT+12');
select is(tests.run(tests.id('a'), tests.wish_sql('ahead')), 'ok', 'paired allow: the same window is taken for a customer at UTC-12');

insert into fx select 'customer_today', ((now() at time zone 'Etc/GMT+12')::date)::text;
select is(tests.run(tests.id('a'), format($q$select public.create_wish('skin_fade', %L, '09:00', '12:00')$q$, (select v::date from fx where k = 'customer_today') + 31)), '22023',
  'create_wish: day 31 on the customer''s calendar is refused');
select is(tests.run(tests.id('a'), format($q$select public.create_wish('skin_fade', %L, '09:00', '12:00')$q$, (select v::date from fx where k = 'customer_today') + 30)), 'ok',
  'paired allow: day 30 on the customer''s calendar is taken');

-- Tomorrow in Berlin starts at most 34 hours from now, so the window start
-- wins over the 48-hour limit and expires_at must be that moment in Berlin.
select tests.set_zone(tests.id('a'), 'Europe/Berlin');
insert into fx select 'berlin_tomorrow', ((now() at time zone 'Europe/Berlin')::date + 1)::text;
select is(tests.run(tests.id('a'), format($q$select public.create_wish('skin_fade', %L, '10:00', '12:00')$q$, (select v::date from fx where k = 'berlin_tomorrow'))), 'ok',
  'setup: a wish for tomorrow in Berlin');
select is((select w.expires_at from public.look_wishes w where w.customer_id = tests.id('a') and w.day = (select v::date from fx where k = 'berlin_tomorrow') and w.window_from = '10:00'),
  ((select v::date from fx where k = 'berlin_tomorrow') + time '10:00') at time zone 'Europe/Berlin',
  'create_wish: expires_at is the window start on the customer''s clock, not in UTC');

-- ------------------------------------------ the booking has the last word --
select tests.set_zone(tests.id('x'), 'Etc/GMT-14');
select is(tests.run(tests.id('a'), format($q$select public.create_booking(%L, %L, %L, 'Street 1', gen_random_uuid())$q$, tests.id('svc_x'), tests.day_of('ahead'), tests.time_of('ahead'))), 'P0001',
  'create_booking refuses the start match_look no longer offers');
select tests.set_zone(tests.id('x'), 'Etc/GMT+12');
select is(tests.run(tests.id('a'), format($q$select public.create_booking(%L, %L, %L, 'Street 1', gen_random_uuid())$q$, tests.id('svc_x'), tests.day_of('ahead'), tests.time_of('ahead'))), 'ok',
  'create_booking takes the start match_look offers');

-- ------------------------------------------------- nothing else changed --
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname) in (('public', 'match_look'), ('private', 'barber_slot_free'), ('public', 'wish_offers'), ('public', 'create_wish'))
    and p.prosrc ~* 'localtimestamp'), 0, 'none of the four functions compares with UTC any more');
select ok(has_function_privilege('authenticated', 'public.match_look(text, date, time, time)', 'execute')
  and not has_function_privilege('anon', 'public.match_look(text, date, time, time)', 'execute'), 'match_look keeps its grants');
select ok(has_function_privilege('authenticated', 'public.create_wish(text, date, time, time, text)', 'execute')
  and not has_function_privilege('anon', 'public.create_wish(text, date, time, time, text)', 'execute'), 'create_wish keeps its grants');
select ok(has_function_privilege('authenticated', 'public.wish_offers(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.wish_offers(uuid)', 'execute'), 'wish_offers keeps its grants');
select ok(not has_function_privilege('authenticated', 'private.barber_slot_free(uuid, date, time, integer)', 'execute'), 'barber_slot_free stays out of the API');

select * from finish();
rollback;
