-- Contract for migration 0059: the nightly barber_stats job (service_role)
-- can read exactly the columns it needs, and nothing private beside them.
begin;

do $$
begin
  if not has_column_privilege('service_role', 'public.barber_profile', 'user_id', 'SELECT') then
    raise exception 'stats job must read barber_profile.user_id';
  end if;
  if not has_column_privilege('service_role', 'public.bookings', 'status', 'SELECT')
     or not has_column_privilege('service_role', 'public.bookings', 'created_at', 'SELECT') then
    raise exception 'stats job must read booking status and timestamps';
  end if;
  if not has_column_privilege('service_role', 'public.notifications', 'booking_status', 'SELECT') then
    raise exception 'stats job must filter notifications by booking_status';
  end if;

  -- Least privilege: the customer's address and the barber's private
  -- verification state stay out of reach.
  if has_column_privilege('service_role', 'public.bookings', 'location', 'SELECT') then
    raise exception 'stats job must not read booking addresses';
  end if;
  if has_column_privilege('service_role', 'public.barber_profile', 'verification_status', 'SELECT') then
    raise exception 'stats job must not read verification status';
  end if;
  if has_table_privilege('service_role', 'public.messages', 'SELECT') then
    raise exception 'stats job must not read messages';
  end if;
end;
$$;

rollback;
