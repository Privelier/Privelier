-- Private Barber — initial schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to re-run: guarded with IF NOT EXISTS / IF EXISTS everywhere practical.

-- ============================================================
-- Extensions
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- Enum types
-- ============================================================

do $$ begin
  create type user_role as enum ('customer', 'barber', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_status_type as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status_type as enum ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tables (created in FK-dependency order; RLS/policies come after
-- every table exists, since several policies reference other tables)
-- ============================================================

-- USERS — extends auth.users. id must match the Supabase Auth user id.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role user_role not null,
  city text,
  country text,
  profile_image text,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_city on public.users(city);
create index if not exists idx_users_role on public.users(role);

-- BARBER_PROFILE — 1:1 with a barber user
create table if not exists public.barber_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  bio text,
  rating numeric(3, 2) not null default 0,
  verified boolean not null default false,
  verification_status verification_status_type not null default 'pending'
);

-- SERVICES — owned by a barber
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0)
);

create index if not exists idx_services_barber_id on public.services(barber_id);

-- AVAILABILITY — owned by a barber
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.users(id) on delete cascade,
  day_of_week smallint check (day_of_week between 0 and 6),
  specific_date date,
  start_time time not null,
  end_time time not null,
  constraint chk_availability_day_or_date check (
    (day_of_week is not null and specific_date is null)
    or (day_of_week is null and specific_date is not null)
  ),
  constraint chk_availability_time_order check (start_time < end_time)
);

create index if not exists idx_availability_barber_id on public.availability(barber_id);

-- BOOKINGS — core state machine, Realtime-enabled
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  date date not null,
  time time not null,
  location text not null,
  price numeric(10, 2) not null check (price >= 0),
  status booking_status_type not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_customer_id on public.bookings(customer_id);
create index if not exists idx_bookings_barber_id on public.bookings(barber_id);

-- CHAT_ROOMS — tied to a booking
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade
);

-- MESSAGES — Realtime-enabled
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_chat_id on public.messages(chat_id);

-- PORTFOLIO — max 6 images per barber (enforced by trigger below)
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.users(id) on delete cascade,
  image_url text not null
);

create index if not exists idx_portfolio_barber_id on public.portfolio(barber_id);

-- REVIEWS — only for completed bookings (enforced by trigger below)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  barber_id uuid not null references public.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text
);

create index if not exists idx_reviews_barber_id on public.reviews(barber_id);

-- VERIFICATION_REQUESTS — admin-only write; no public read
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  id_image_url text not null,
  license_image_url text not null,
  status verification_status_type not null default 'pending',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz
);

create index if not exists idx_verification_requests_user_id on public.verification_requests(user_id);

-- ============================================================
-- Helper functions
-- ============================================================

-- Runs as the function owner (postgres, which has BYPASSRLS in Supabase),
-- so the internal query never re-triggers the users SELECT policy. Without
-- this, checking "is the caller an admin?" from inside a policy on users
-- (or on any table whose policy checks users) causes infinite RLS
-- recursion — discovered live via a 42P17 error when this was inlined as
-- a plain subquery instead.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- Grants
-- Creating a table via the SQL Editor does NOT automatically grant
-- anon/authenticated any SQL-level privilege on it (unlike creating one
-- through the Table Editor UI). RLS policies below are the real gate;
-- these grants just let PostgREST reach the table at all.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on public.users, public.barber_profile, public.services, public.availability,
     public.bookings, public.chat_rooms, public.messages, public.portfolio,
     public.reviews, public.verification_requests
  to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- ============================================================
-- Row Level Security — enabled on every table
-- ============================================================

alter table public.users enable row level security;
alter table public.barber_profile enable row level security;
alter table public.services enable row level security;
alter table public.availability enable row level security;
alter table public.bookings enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.messages enable row level security;
alter table public.portfolio enable row level security;
alter table public.reviews enable row level security;
alter table public.verification_requests enable row level security;

-- ---- USERS ----

drop policy if exists "users_select_own_or_admin_or_approved_barber" on public.users;
create policy "users_select_own_or_admin_or_approved_barber"
  on public.users for select
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      role = 'barber'
      and exists (
        select 1 from public.barber_profile bp
        where bp.user_id = users.id and bp.verification_status = 'approved'
      )
    )
  );

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
  on public.users for insert
  with check (id = auth.uid());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- BARBER_PROFILE ----

drop policy if exists "barber_profile_select_own_or_admin_or_approved" on public.barber_profile;
create policy "barber_profile_select_own_or_admin_or_approved"
  on public.barber_profile for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or verification_status = 'approved'
  );

drop policy if exists "barber_profile_insert_own" on public.barber_profile;
create policy "barber_profile_insert_own"
  on public.barber_profile for insert
  with check (user_id = auth.uid());

drop policy if exists "barber_profile_update_own" on public.barber_profile;
create policy "barber_profile_update_own"
  on public.barber_profile for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- SERVICES ----

drop policy if exists "services_select_all" on public.services;
create policy "services_select_all"
  on public.services for select
  using (true);

drop policy if exists "services_write_own" on public.services;
create policy "services_write_own"
  on public.services for all
  using (barber_id = auth.uid())
  with check (barber_id = auth.uid());

-- ---- AVAILABILITY ----

drop policy if exists "availability_select_all" on public.availability;
create policy "availability_select_all"
  on public.availability for select
  using (true);

drop policy if exists "availability_write_own" on public.availability;
create policy "availability_write_own"
  on public.availability for all
  using (barber_id = auth.uid())
  with check (barber_id = auth.uid());

-- ---- BOOKINGS ----

drop policy if exists "bookings_select_participants" on public.bookings;
create policy "bookings_select_participants"
  on public.bookings for select
  using (customer_id = auth.uid() or barber_id = auth.uid());

drop policy if exists "bookings_insert_customer" on public.bookings;
create policy "bookings_insert_customer"
  on public.bookings for insert
  with check (customer_id = auth.uid() and status = 'pending');

drop policy if exists "bookings_update_participants" on public.bookings;
create policy "bookings_update_participants"
  on public.bookings for update
  using (customer_id = auth.uid() or barber_id = auth.uid())
  with check (customer_id = auth.uid() or barber_id = auth.uid());

-- ---- CHAT_ROOMS ----

drop policy if exists "chat_rooms_select_participants" on public.chat_rooms;
create policy "chat_rooms_select_participants"
  on public.chat_rooms for select
  using (customer_id = auth.uid() or barber_id = auth.uid());

drop policy if exists "chat_rooms_insert_participants" on public.chat_rooms;
create policy "chat_rooms_insert_participants"
  on public.chat_rooms for insert
  with check (customer_id = auth.uid() or barber_id = auth.uid());

-- ---- MESSAGES ----

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages for select
  using (
    exists (
      select 1 from public.chat_rooms cr
      where cr.id = messages.chat_id
        and (cr.customer_id = auth.uid() or cr.barber_id = auth.uid())
    )
  );

drop policy if exists "messages_insert_participants" on public.messages;
create policy "messages_insert_participants"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_rooms cr
      where cr.id = messages.chat_id
        and (cr.customer_id = auth.uid() or cr.barber_id = auth.uid())
    )
  );

-- ---- PORTFOLIO ----

drop policy if exists "portfolio_select_all" on public.portfolio;
create policy "portfolio_select_all"
  on public.portfolio for select
  using (true);

drop policy if exists "portfolio_write_own" on public.portfolio;
create policy "portfolio_write_own"
  on public.portfolio for all
  using (barber_id = auth.uid())
  with check (barber_id = auth.uid());

-- ---- REVIEWS ----

drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all"
  on public.reviews for select
  using (true);

drop policy if exists "reviews_insert_own_customer" on public.reviews;
create policy "reviews_insert_own_customer"
  on public.reviews for insert
  with check (customer_id = auth.uid());

-- ---- VERIFICATION_REQUESTS ----

drop policy if exists "verification_requests_select_own" on public.verification_requests;
create policy "verification_requests_select_own"
  on public.verification_requests for select
  using (user_id = auth.uid());

drop policy if exists "verification_requests_insert_own" on public.verification_requests;
create policy "verification_requests_insert_own"
  on public.verification_requests for insert
  with check (user_id = auth.uid());

-- Deliberately no UPDATE policy for authenticated users: only the
-- service_role (i.e. an admin, via the Supabase dashboard) can set
-- status / reviewed_by / reviewed_at, per the manual-verification-only
-- rule in CLAUDE.md.

-- ============================================================
-- Triggers
-- ============================================================

-- Barbers can edit their own bio, but only an admin (service_role, via the
-- Supabase dashboard) may flip verified / verification_status — otherwise a
-- barber could self-approve. This silently reverts those two columns for
-- any update not made with the service_role key.
create or replace function public.protect_barber_verification_fields()
returns trigger as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.verified := old.verified;
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_barber_verification on public.barber_profile;
create trigger trg_protect_barber_verification
  before update on public.barber_profile
  for each row execute function public.protect_barber_verification_fields();

-- Enforce the exact branching state machine from CLAUDE.md:
--   pending  -> accepted | rejected
--   accepted -> completed | cancelled
-- No other transitions are allowed.
create or replace function public.enforce_booking_status_transition()
returns trigger as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'rejected') then
    return new;
  end if;

  if old.status = 'accepted' and new.status in ('completed', 'cancelled') then
    return new;
  end if;

  raise exception 'Invalid booking status transition: % -> %', old.status, new.status;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_booking_status_transition on public.bookings;
create trigger trg_enforce_booking_status_transition
  before update on public.bookings
  for each row execute function public.enforce_booking_status_transition();

-- Max 6 portfolio images per barber.
create or replace function public.enforce_portfolio_max_six()
returns trigger as $$
begin
  if (select count(*) from public.portfolio where barber_id = new.barber_id) >= 6 then
    raise exception 'A barber may not have more than 6 portfolio images';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_portfolio_max_six on public.portfolio;
create trigger trg_enforce_portfolio_max_six
  before insert on public.portfolio
  for each row execute function public.enforce_portfolio_max_six();

-- A review may only be created for a booking whose status is 'completed'.
create or replace function public.enforce_review_requires_completed_booking()
returns trigger as $$
declare
  booking_status booking_status_type;
begin
  select status into booking_status from public.bookings where id = new.booking_id;

  if booking_status is distinct from 'completed' then
    raise exception 'A review can only be created for a completed booking';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_review_requires_completed on public.reviews;
create trigger trg_enforce_review_requires_completed
  before insert on public.reviews
  for each row execute function public.enforce_review_requires_completed_booking();

-- ============================================================
-- Realtime — enabled on BOOKINGS and MESSAGES per CLAUDE.md
-- ============================================================

do $$ begin
  alter publication supabase_realtime add table public.bookings;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
