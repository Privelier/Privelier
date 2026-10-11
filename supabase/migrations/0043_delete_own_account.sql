-- In-app account deletion (App Store 5.1.1(v), Google Play account-deletion
-- policy, GDPR erasure). The signed-in user deletes ONLY their own account.
--
-- - Refuses while the account has a live booking (pending or accepted), so
--   the other participant never silently loses an upcoming appointment; the
--   client tells the user to cancel those first. SQLSTATE PA001.
-- - Deletes auth.users for auth.uid(); every public table cascades from it
--   (users -> profile, services, availability, bookings, chats, messages,
--   reviews, portfolio rows, notifications, consent history, blocks,
--   reports).
-- - Recomputes the rating of every barber the user had reviewed, because
--   the review rows disappear with the account and the rating trigger only
--   fires on insert.
-- - Storage objects are NOT reachable from SQL: the client removes the
--   user's public portfolio images through the Storage API first; private
--   verification documents need a service-role cleanup (tracked follow-up).

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user uuid := auth.uid();
  v_reviewed_barbers uuid[];
  v_stashed_role text;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.bookings b
    where (b.customer_id = v_user or b.barber_id = v_user)
      and b.status in ('pending', 'accepted')
  ) then
    raise exception 'cancel your active bookings before deleting your account'
      using errcode = 'PA001';
  end if;

  select coalesce(array_agg(distinct r.barber_id), '{}')
    into v_reviewed_barbers
    from public.reviews r
   where r.customer_id = v_user;

  delete from auth.users where id = v_user;

  if array_length(v_reviewed_barbers, 1) > 0 then
    -- barber_profile.rating is trigger-protected for clients; impersonate the
    -- server role transaction-locally exactly like recompute_barber_rating.
    v_stashed_role := current_setting('request.jwt.claim.role', true);
    perform set_config('request.jwt.claim.role', 'service_role', true);
    update public.barber_profile bp
       set rating = coalesce((
         select round(avg(r.rating)::numeric, 2)
         from public.reviews r
         where r.barber_id = bp.user_id
       ), 0)
     where bp.user_id = any(v_reviewed_barbers);
    perform set_config('request.jwt.claim.role', coalesce(v_stashed_role, ''), true);
  end if;
end;
$function$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
