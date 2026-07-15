-- Barber location with privacy-offset display coordinates (Explore/location
-- Run A, schema stage; 2026-07-15). Design approved with conditions C1-C4:
-- docs/design/explore-location-design-approval.md -- this file is the exact
-- implementation of its "Approved schema" section.
--
-- WHAT THIS ENABLES: a barber stores their exact geocoded address and
-- coordinates so customers can see an APPROXIMATE area pin on the Explore
-- map. The exact coordinates are internal-only (founder decision D2): the
-- public-facing pin is offset by a randomized ~200-500 m displacement.
--
-- PRIVACY MODEL (the whole point of this table -- do not "simplify" it):
--
--  1. Exact address/latitude/longitude live in a NEW table,
--     public.barber_location, readable ONLY through own-row RLS
--     (user_id = auth.uid()). They are deliberately NOT columns on
--     barber_profile: that table's SELECT policy lets any authenticated
--     user read approved barbers' rows directly via PostgREST, which would
--     expose the exact coordinates and defeat D2 entirely (condition C1).
--
--  2. display_latitude/display_longitude hold a STORED-ONCE offset copy,
--     computed server-side by a BEFORE trigger at write time. Rejected
--     alternatives (recorded in the design doc): a per-read randomized
--     offset in the view -- repeated sampling averages back to the true
--     location, statistically reversible; a deterministic offset derived
--     from a public id -- reversible by anyone who learns the formula.
--     Storing the offset once means there is no sampling channel to attack
--     and the customer-visible pin never wanders. A fresh offset IS redrawn
--     whenever the exact coordinates change, so no long-lived correlatable
--     offset survives a move.
--
--  3. The trigger overwrites the display columns UNCONDITIONALLY on every
--     INSERT and UPDATE (condition C2): a client-supplied display value can
--     never survive, so a raw PostgREST write cannot plant a fake pin or
--     copy the exact coordinates into the public columns.
--
--  4. The SECURITY DEFINER barber_directory view -- already this project's
--     deliberate, documented cross-user read surface (0006's header explains
--     why definer behavior is intentional there, not an oversight) -- LEFT
--     JOINs this table and publishes ONLY display_latitude/display_longitude
--     (plus bp.verified, wanted by Explore's filter chips). It must NEVER
--     select address/latitude/longitude (condition C3). LEFT JOIN is
--     mandatory: barbers without location data stay in the directory/list
--     and simply have NULL display coords -- the app renders no pin for
--     them, never a fake one (founder decision D4).
--
--  5. RANDOMNESS SOURCE: plain random() (PRNG, not CSPRNG) is the approved,
--     documented choice. The threat model is "don't publish the exact
--     address"; the 200-500 m distance window itself bounds inference, and
--     with the offset stored once there is no repeated-draw channel through
--     which PRNG state could be observed or attacked.
--
--  6. service_role KEEPS full DML here, granted explicitly below. 0014's
--     strict revoke left service_role with no DML on chat_read_state (a
--     tracked papercut for future admin tooling); this migration decides
--     deliberately NOT to repeat that -- founder/dashboard tooling may need
--     to correct or clear a barber's location row.
--
-- No DELETE policy and no client DELETE grant by design: "clearing" a
-- location = updating address/latitude/longitude to NULL (the trigger then
-- NULLs the display columns too); the row itself cascades away with the
-- user.
--
-- IDEMPOTENT: create table if not exists / create or replace function /
-- drop-policy-and-trigger-if-exists guards throughout -- safe to run twice.
-- Live-data note (condition C4): the table is brand new, so the CHECK
-- constraints trivially hold at apply time; the view recreation is a
-- drop-and-recreate whose grants are re-issued explicitly below.

-- ============================================================
-- 1. The table. CHECKs are inline (new table -- no DO-block guards needed,
--    unlike 0018's additions to existing tables):
--      * address: NULL, or 1..300 chars after trimming (whitespace-only
--        rejected; same shape as 0018's bio/message bounds). The app write
--        path trims and maps empty -> NULL; this closes the raw-API gap.
--      * latitude/longitude: valid geographic ranges, and both-or-neither
--        set -- a half-set coordinate pair is meaningless and would let the
--        trigger emit a nonsense pin.
--      * display columns carry NO client-facing contract of their own: the
--        trigger in section 3 is their single source of truth.
--      * location_updated_at is app-written (design condition C5: the data
--        layer writes exactly address/latitude/longitude/location_updated_at)
--        -- deliberately no default and no trigger maintenance here.
-- ============================================================

create table if not exists public.barber_location (
  user_id             uuid primary key references public.users(id) on delete cascade,
  address             text,
  latitude            double precision,
  longitude           double precision,
  display_latitude    double precision,
  display_longitude   double precision,
  location_updated_at timestamptz,
  constraint chk_barber_location_address_len
    check (address is null or char_length(btrim(address)) between 1 and 300),
  constraint chk_barber_location_latitude_range
    check (latitude is null or latitude between -90 and 90),
  constraint chk_barber_location_longitude_range
    check (longitude is null or longitude between -180 and 180),
  constraint chk_barber_location_coords_paired
    check ((latitude is null) = (longitude is null))
);

-- No secondary index: the PK serves both the own-row RLS lookups and the
-- view's LEFT JOIN (bl.user_id = u.id).

-- ============================================================
-- 2. RLS -- own-row only, on every verb that exists here. This single
--    property IS condition C1: no policy grants any other user visibility,
--    so exact address/coords are readable by their owner alone (and by
--    service_role, which bypasses RLS). Policies are scoped `to
--    authenticated` explicitly (0006 step-E defense in depth: even a
--    mistaken future anon table grant would still be refused row-level).
-- ============================================================

alter table public.barber_location enable row level security;

drop policy if exists barber_location_select_own on public.barber_location;
create policy barber_location_select_own
  on public.barber_location for select
  to authenticated
  using (user_id = auth.uid());

-- INSERT additionally requires the barber role (0004's pattern for
-- barber-owned rows): customers have no business creating location rows.
drop policy if exists barber_location_insert_own on public.barber_location;
create policy barber_location_insert_own
  on public.barber_location for insert
  to authenticated
  with check (user_id = auth.uid() and public.has_role('barber'));

-- UPDATE: own row in, own row out. WITH CHECK re-asserts user_id =
-- auth.uid() so the PK cannot be re-pointed at another user. No has_role
-- re-check needed: only a barber can have passed the INSERT policy, and a
-- row's owner does not change.
drop policy if exists barber_location_update_own on public.barber_location;
create policy barber_location_update_own
  on public.barber_location for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No DELETE policy on purpose (see header): clearing = NULLing the columns.

-- ============================================================
-- 3. The offset trigger -- server-side, unconditional (condition C2).
--
--    BEFORE INSERT OR UPDATE, every branch assigns the display columns, so
--    whatever a client sent for them is ALWAYS discarded:
--      * exact coords NULL          -> display coords NULL;
--      * INSERT with coords, or UPDATE where latitude/longitude actually
--        changed (IS DISTINCT FROM) -> draw a fresh offset;
--      * UPDATE with coords unchanged (e.g. address-only edit) -> preserve
--        OLD display values -- no redraw, the public pin stays put.
--
--    Offset math (equirectangular, exact per the approved design): bearing
--    theta uniform in [0, 2*pi), distance d uniform in [200, 500] meters;
--      delta_lat = d * cos(theta) / 111320.0
--      delta_lng = d * sin(theta) / (111320.0 * cos(radians(latitude)))
--    (111320 m per degree of latitude; the cos() divisor widens the
--    longitude delta so the ground distance stays ~d at any latitude.)
--
--    WHY NO CLAMP/WRAP: |delta_lat| <= 500/111320 ~= 0.0045 degrees, so
--    display_latitude could only escape [-90, 90] if the true latitude
--    (itself CHECK-bounded to [-90, 90]) were within ~500 m of a geographic
--    pole -- where no serviceable barber address exists. Same non-case for
--    the cos() divisor degenerating near the poles (and float cos() never
--    returns exactly 0 there, so no division error even then). Documented
--    impossibility, not a code path.
--
--    NOT security definer (unlike 0005/0015's triggers): this function
--    reads no other table and never consults auth.role() -- it only rewrites
--    NEW from OLD and random(), so invoker rights suffice. search_path is
--    still pinned (0002's hardening convention) and EXECUTE is revoked from
--    the PostgREST-exposed roles: trigger firing does not depend on EXECUTE
--    (same rationale as 0002/0005/0015), so no client can call it directly.
-- ============================================================

create or replace function public.compute_barber_display_location()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  theta double precision;
  dist  double precision;
begin
  if new.latitude is null then
    -- Coords absent/cleared: no pin at all (D4 -- never a fake one).
    new.display_latitude  := null;
    new.display_longitude := null;
    return new;
  end if;

  -- OLD is only referenced inside an explicit tg_op = 'UPDATE' branch:
  -- OLD is unassigned in a BEFORE INSERT firing, and SQL boolean operators
  -- do not guarantee short-circuit order, so a flat
  -- `tg_op = 'INSERT' or new.x is distinct from old.x` would be unsafe
  -- (same reason 0015's trigger branches on tg_op explicitly).
  if tg_op = 'UPDATE' then
    if new.latitude  is not distinct from old.latitude
       and new.longitude is not distinct from old.longitude then
      -- Coords unchanged (address-only edit, or a raw UPDATE poking at the
      -- display columns): keep the stored offset -- and, either way,
      -- discard whatever the client supplied for the display columns.
      new.display_latitude  := old.display_latitude;
      new.display_longitude := old.display_longitude;
      return new;
    end if;
  end if;

  -- INSERT with coords, or UPDATE where they changed: draw a fresh offset.
  theta := 2 * pi() * random();          -- bearing, uniform [0, 2*pi)
  dist  := 200 + 300 * random();         -- meters, uniform [200, 500]
  new.display_latitude  := new.latitude
    + dist * cos(theta) / 111320.0;
  new.display_longitude := new.longitude
    + dist * sin(theta) / (111320.0 * cos(radians(new.latitude)));
  return new;
end;
$function$;

revoke execute on function public.compute_barber_display_location() from public, anon, authenticated;

drop trigger if exists trg_compute_barber_display_location on public.barber_location;
create trigger trg_compute_barber_display_location
  before insert or update on public.barber_location
  for each row execute function public.compute_barber_display_location();

-- ============================================================
-- 4. Grants -- 0014's revoke-then-grant posture: anon has no footprint at
--    all; authenticated gets exactly select/insert/update (no DELETE, per
--    the no-delete design above). Unlike 0014, service_role is granted full
--    DML explicitly (header note 6) so founder/admin tooling is never
--    locked out of correcting a location row.
-- ============================================================

revoke all on public.barber_location from public, anon, authenticated;
grant select, insert, update on public.barber_location to authenticated;
grant select, insert, update, delete on public.barber_location to service_role;

-- ============================================================
-- 5. Recreate public.barber_directory -- same view as 0006 plus exactly
--    three columns (condition C3): bp.verified (Explore's "Verified" chip)
--    and the two DISPLAY coordinates via LEFT JOIN. Everything 0006's
--    header established still holds and is deliberately unchanged:
--
--      * SECURITY DEFINER behavior (Postgres default: owner's privileges/
--        row-visibility) is INTENTIONAL -- the view's purpose is to show
--        approved barbers to callers who are neither row owner nor admin,
--        i.e. it must bypass the own-row RLS on users/barber_profile AND
--        on barber_location. Do NOT flip this to security_invoker: with
--        invoker rights the LEFT JOIN would return NULL display coords for
--        every barber except the caller themselves. The `where
--        bp.verification_status = 'approved'` clause remains the real gate.
--      * The SELECT list is a hand-picked allowlist. It must NEVER name
--        address, latitude, or longitude -- the display columns are the
--        ONLY location data that leaves barber_location through any
--        cross-user surface (conditions C1 + C3).
--      * Column allowlisting is the second layer: even if the WHERE clause
--        were ever loosened by mistake, there is no exact-location column
--        here to leak.
--
--    drop-and-recreate (0006's own idiom) rather than CREATE OR REPLACE,
--    so the definition below is the whole truth; grants are dropped with
--    the view, so re-grant -- SELECT to authenticated only, same as today.
-- ============================================================

drop view if exists public.barber_directory;
create view public.barber_directory as
  select
    u.id,
    u.name,
    u.city,
    u.country,
    u.profile_image,
    bp.bio,
    bp.rating,
    bp.verified,
    bl.display_latitude,
    bl.display_longitude
  from public.users u
  join public.barber_profile bp on bp.user_id = u.id
  left join public.barber_location bl on bl.user_id = u.id
  where bp.verification_status = 'approved';

grant select on public.barber_directory to authenticated;
