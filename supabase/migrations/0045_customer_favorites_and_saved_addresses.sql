-- Wave 2 customer personalization. Both tables are strictly owner-only.
--
-- customer_favorites: a customer's saved barbers. Insert requires the
-- customer role and an approved barber, so favorites can only point at
-- profiles the customer could discover anyway.
--
-- customer_addresses: labelled addresses for the booking flow. Exact home
-- addresses are sensitive: only their owner can read or change them, and
-- they reach a barber only as the text the customer puts on a booking.
-- Capped at 10 per customer by trigger.

create table public.customer_favorites (
  customer_id uuid not null references public.users(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, barber_id),
  constraint customer_favorites_not_self check (customer_id <> barber_id)
);
create index customer_favorites_barber_idx on public.customer_favorites (barber_id);

alter table public.customer_favorites enable row level security;
revoke all on public.customer_favorites from public, anon, authenticated;
grant select, insert, delete on public.customer_favorites to authenticated;

create policy customer_favorites_select_own on public.customer_favorites
  for select to authenticated using (customer_id = (select auth.uid()));
create policy customer_favorites_insert_own on public.customer_favorites
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and public.has_role('customer')
    and exists (
      select 1 from public.barber_profile bp
      where bp.user_id = customer_favorites.barber_id
        and bp.verification_status = 'approved'::public.verification_status_type
    )
  );
create policy customer_favorites_delete_own on public.customer_favorites
  for delete to authenticated using (customer_id = (select auth.uid()));

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 40),
  address text not null check (char_length(btrim(address)) between 3 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_addresses_customer_idx on public.customer_addresses (customer_id, updated_at desc);

alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from public, anon, authenticated;
grant select, insert, delete on public.customer_addresses to authenticated;
grant update (label, address, updated_at) on public.customer_addresses to authenticated;

create policy customer_addresses_select_own on public.customer_addresses
  for select to authenticated using (customer_id = (select auth.uid()));
create policy customer_addresses_insert_own on public.customer_addresses
  for insert to authenticated
  with check (customer_id = (select auth.uid()) and public.has_role('customer'));
create policy customer_addresses_update_own on public.customer_addresses
  for update to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));
create policy customer_addresses_delete_own on public.customer_addresses
  for delete to authenticated using (customer_id = (select auth.uid()));

create or replace function public.enforce_customer_address_cap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('customer_addresses:' || new.customer_id::text, 0));
  if (select count(*) from public.customer_addresses where customer_id = new.customer_id) >= 10 then
    raise exception 'A customer can save at most 10 addresses' using errcode = 'PA002';
  end if;
  return new;
end;
$function$;
revoke execute on function public.enforce_customer_address_cap() from public, anon, authenticated;

create trigger trg_customer_address_cap
  before insert on public.customer_addresses
  for each row execute function public.enforce_customer_address_cap();
