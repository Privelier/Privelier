-- Studio dashboard aggregates. All booking scans and calculations stay in
-- Postgres; the only appointment detail returned is the barber's own next
-- accepted booking, with display names and no location/contact fields.

create or replace function public.get_barber_dashboard_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_barber_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_barber_id is null or not exists (
    select 1
    from public.users u
    where u.id = v_barber_id
      and u.role = 'barber'::public.user_role
  ) then
    raise exception using errcode = '42501', message = 'Barber role required';
  end if;

  with own_bookings as materialized (
    select b.id, b.customer_id, b.service_id, b.date, b.time, b.price, b.status
    from public.bookings b
    where b.barber_id = v_barber_id
  ),
  booking_totals as (
    select
      count(*) filter (where b.status = 'completed' and b.date >= date_trunc('week', current_date::timestamp)::date and b.date < (date_trunc('week', current_date::timestamp) + interval '1 week')::date) as completed_week,
      count(*) filter (where b.status = 'completed' and b.date >= date_trunc('month', current_date::timestamp)::date and b.date < (date_trunc('month', current_date::timestamp) + interval '1 month')::date) as completed_month,
      count(*) filter (where b.status = 'completed') as completed_all_time,
      coalesce(sum(b.price) filter (where b.status = 'completed' and b.date >= date_trunc('week', current_date::timestamp)::date and b.date < (date_trunc('week', current_date::timestamp) + interval '1 week')::date), 0) as booked_value_week,
      coalesce(sum(b.price) filter (where b.status = 'completed' and b.date >= date_trunc('month', current_date::timestamp)::date and b.date < (date_trunc('month', current_date::timestamp) + interval '1 month')::date), 0) as booked_value_month,
      coalesce(sum(b.price) filter (where b.status = 'completed'), 0) as booked_value_all_time,
      count(*) filter (where b.status = 'pending') as pending_count,
      count(*) filter (
        where b.status = 'accepted'
          and b.date + b.time >= localtimestamp
          and b.date < current_date + 8
      ) as upcoming_count
    from own_bookings b
  ),
  week_buckets as (
    select generate_series(
      date_trunc('week', current_date::timestamp) - interval '7 weeks',
      date_trunc('week', current_date::timestamp),
      interval '1 week'
    )::date as week_start
  ),
  weekly_values as (
    select w.week_start, count(b.id) as completed_cuts, coalesce(sum(b.price), 0) as booked_value
    from week_buckets w
    left join own_bookings b
      on b.status = 'completed'
      and b.date >= w.week_start
      and b.date < w.week_start + 7
    group by w.week_start
  ),
  weekly_trend as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'week_start', to_char(week_start, 'YYYY-MM-DD'),
      'completed_cuts', completed_cuts,
      'booked_value', booked_value
    ) order by week_start), '[]'::jsonb) as items
    from weekly_values
  ),
  next_appointment as (
    select jsonb_build_object(
      'date', b.date,
      'time', b.time,
      'customer_name', u.name,
      'service_name', s.name
    ) as item
    from own_bookings b
    left join public.users u on u.id = b.customer_id
    left join public.services s on s.id = b.service_id
    where b.status = 'accepted'
      and b.date + b.time >= localtimestamp
    order by b.date, b.time, b.id
    limit 1
  ),
  review_stats as (
    select round(avg(r.rating)::numeric, 2) as rating_average, count(*) as review_count
    from public.reviews r
    where r.barber_id = v_barber_id
  ),
  repeat_customers as (
    select count(*) as customer_count
    from (
      select b.customer_id
      from own_bookings b
      where b.status = 'completed'
      group by b.customer_id
      having count(*) >= 2
    ) repeated
  ),
  service_insights as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', ranked.name,
      'completed_cuts', ranked.completed_cuts,
      'booked_value', ranked.booked_value
    ) order by ranked.completed_cuts desc, lower(ranked.name)), '[]'::jsonb) as items
    from (
      select s.name, count(*) as completed_cuts, coalesce(sum(b.price), 0) as booked_value
      from own_bookings b
      join public.services s on s.id = b.service_id
      where b.status = 'completed'
      group by s.id, s.name
      order by count(*) desc, lower(s.name)
      limit 3
    ) ranked
  ),
  weekday_insight as (
    select case extract(dow from b.date)::integer
      when 0 then 'Sunday'
      when 1 then 'Monday'
      when 2 then 'Tuesday'
      when 3 then 'Wednesday'
      when 4 then 'Thursday'
      when 5 then 'Friday'
      else 'Saturday'
    end as weekday,
    count(*) as completed_cuts
    from own_bookings b
    where b.status = 'completed'
    group by extract(dow from b.date)
    order by count(*) desc, extract(dow from b.date)
    limit 1
  )
  select jsonb_build_object(
    'completed_week', t.completed_week,
    'completed_month', t.completed_month,
    'completed_all_time', t.completed_all_time,
    'booked_value_week', t.booked_value_week,
    'booked_value_month', t.booked_value_month,
    'booked_value_all_time', t.booked_value_all_time,
    'pending_count', t.pending_count,
    'upcoming_count', t.upcoming_count,
    'next_appointment', (select item from next_appointment),
    'weekly_trend', (select items from weekly_trend),
    'rating_average', r.rating_average,
    'review_count', r.review_count,
    'repeat_customer_count', rc.customer_count,
    'top_services', si.items,
    'busiest_weekday', (select jsonb_build_object(
      'weekday', weekday_insight.weekday,
      'completed_cuts', weekday_insight.completed_cuts
    ) from weekday_insight)
  ) into v_result
  from booking_totals t
  cross join review_stats r
  cross join repeat_customers rc
  cross join service_insights si
  cross join weekly_trend wt;

  return v_result;
end;
$function$;

revoke execute on function public.get_barber_dashboard_analytics() from public, anon;
grant execute on function public.get_barber_dashboard_analytics() to authenticated;

-- SQL Editor users do not run `supabase migration up`; keep the hosted ledger
-- aligned with this checked-in migration after applying the full file.
insert into supabase_migrations.schema_migrations (version, name)
values ('0034', '0034_barber_dashboard_analytics')
on conflict (version) do nothing;
