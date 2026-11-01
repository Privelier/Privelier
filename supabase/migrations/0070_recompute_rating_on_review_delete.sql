-- Founders remove a review that breaks the content rules with a plain DELETE
-- in the SQL editor (decision D24). The barber's average rating must follow,
-- so the aggregate is recomputed after a delete as well as after an insert.
-- Clients still cannot delete reviews (no DELETE grant).
create or replace function public.recompute_barber_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stashed_role text;
  v_barber uuid := coalesce(new.barber_id, old.barber_id);
begin
  stashed_role := current_setting('request.jwt.claim.role', true);

  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.barber_profile
     set rating = (
       select coalesce(round(avg(rating)::numeric, 2), 0)
       from public.reviews
       where barber_id = v_barber
     )
   where user_id = v_barber;

  perform set_config('request.jwt.claim.role', coalesce(stashed_role, ''), true);

  return null;
end;
$$;

drop trigger if exists trg_recompute_barber_rating on public.reviews;
create trigger trg_recompute_barber_rating
  after insert or delete on public.reviews
  for each row execute function public.recompute_barber_rating();
