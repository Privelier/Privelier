# Design approval — barber location data (Run A) + Explore tab (Run B)

Date: 2026-07-15. Architect-review gate applied manually per
`.claude/agents/architect-review.md` (not a spawnable subagent_type — known
harness gap, see Cross-cutting hygiene). Task decomposition ran first
(task-decomposition-expert, 23 tasks, two pipeline runs, cross-run dependency
B-3b → A-4).

## Founder decisions (2026-07-15, verbatim intent)

- D1: Mapbox over Google Maps. Public token `EXPO_PUBLIC_MAPBOX_TOKEN` in
  `.env` (public-by-design `pk.` token, same trust class as the anon key).
- D2: Store the barber's exact geocoded coordinates, but the public-facing
  pin shows a randomized ~200–500 m offset — the exact coordinates are
  internal-only, never exposed to customers.
- D3: The prototype's "House calls" filter chip is repurposed to "Verified".
- D4: No fake/placeholder pins ever; barbers without location data simply
  don't appear on the map (still appear in list/Discover).

## Live facts the design rests on (verified via MCP 2026-07-15)

- No lat/lng/address column exists anywhere; location data today is
  `users.city`/`users.country` (text) and `bookings.location` (customer's
  address for one booking).
- `barber_profile` SELECT policy `barber_profile_select_own_or_admin_or_approved`
  lets ANY authenticated user read approved barbers' rows **directly via
  PostgREST** — the view is not the only read surface for that table.
- `barber_directory` = SECURITY DEFINER view over users ⨝ barber_profile,
  WHERE approved; exposes exactly `id, name, city, country, profile_image,
  bio, rating`. It does NOT expose `verified`.
- Only trigger on `barber_profile` is 0005's verification-fields freeze.
- App conventions: `fetchOwnBarberProfile` and the discovery reads use
  `select('*')`; BarberCard renders the verified badge for every directory
  row (approved ⇒ verified by construction — recorded founder decision).

## Architectural impact: HIGH (new table, view change, new external API, new tab)

## The one design correction (vs the founder wording and the WBS)

D2 says "latitude/longitude on barber_profile". Implemented literally, the
exact coordinates would be readable by every authenticated customer through
the table's own SELECT policy, defeating D2's entire purpose. The intent
(exact coords never customer-visible) therefore overrides the wording:

**Exact location data lives in a new `barber_location` table with own-only
RLS.** The SECURITY DEFINER `barber_directory` view — already the project's
deliberate, documented cross-user read surface — LEFT JOINs it and publishes
ONLY the stored display (offset) coordinates.

Rejected alternatives:
- Columns on `barber_profile` + column-level REVOKEs: breaks every existing
  `select('*')` read including the barber's own, and still leaves `address`
  exposure to get right; brittle.
- Per-read randomized offset in the view: repeated sampling averages out to
  the true location — statistically reversible. REJECTED.
- Deterministic offset from a public id: reversible by anyone who learns the
  formula. REJECTED.
- Stored offset, generated server-side at write time: stable, irreversible,
  survives re-reads. ACCEPTED.

## Approved schema (migration 0019 — supabase-schema-architect authors; verify next free ledger number live first)

`barber_location`:
- `user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
- `address text` — the barber's own display string, trimmed, empty→NULL,
  CHECK length ≤ 300
- `latitude double precision`, `longitude double precision` — exact, CHECKs:
  lat ∈ [-90, 90], lng ∈ [-180, 180], and `(latitude IS NULL) = (longitude IS NULL)`
- `display_latitude double precision`, `display_longitude double precision`
  — NEVER client-written (trigger always overwrites; see below)
- `location_updated_at timestamptz`
- RLS: SELECT/INSERT/UPDATE own-row only (`user_id = auth.uid()`), INSERT
  also requires `has_role('barber')`; no DELETE policy (clearing = setting
  lat/lng/address NULL); anon: no grants; authenticated: table grants for
  SELECT/INSERT/UPDATE only.

Offset trigger (BEFORE INSERT OR UPDATE):
- Always recomputes `display_latitude/display_longitude` — client-supplied
  display values are ignored/overwritten unconditionally (closes the raw-
  UPDATE bypass).
- When `latitude IS NULL` → both display columns NULL.
- When coordinates are set/changed (`IS DISTINCT FROM`): bearing θ uniform in
  [0, 2π), distance d uniform in [200, 500] m,
  `Δlat = d·cos(θ)/111320`, `Δlng = d·sin(θ)/(111320·cos(radians(latitude)))`.
  Plain `random()` is acceptable: the threat model is "don't publish the
  exact address", and the 300 m distance window itself bounds inference; the
  offset is stored once, so there is no sampling channel to attack. A fresh
  offset is drawn on every coordinate change (no long-lived correlatable
  offset).
- When coordinates are unchanged on an UPDATE (e.g. address-only edit): keep
  the existing display values — do NOT redraw (a redraw on unrelated edits
  would create a sampling channel via repeated self-edits… it would not, the
  reader can't trigger it, but stability also keeps the customer-visible pin
  from wandering; keep it deterministic: redraw iff lat/lng changed).

`barber_directory` view (recreated in the same migration): adds
`bp.verified`, `bl.display_latitude`, `bl.display_longitude` via
`LEFT JOIN barber_location bl ON bl.user_id = u.id`. LEFT JOIN is mandatory
(D4: location-less barbers stay in the directory). The view must NEVER
select `address`/`latitude`/`longitude`.

## Approved app design

Run A (this pipeline run):
- `src/shared/geocoding.ts`: forward geocoding via plain `fetch` to Mapbox's
  Geocoding API with `EXPO_PUBLIC_MAPBOX_TOKEN`; returns candidates
  `{ label, latitude, longitude }`; never logs the token or full URL outside
  `__DEV__`; no native module involved.
- `src/barber/locationData.ts`: `fetchOwnLocation(userId)` +
  `updateOwnLocation(userId, { address, latitude, longitude })` — upsert own
  row (PK user_id), writes ONLY those columns + `location_updated_at`;
  trim/empty→NULL address; both-or-neither coords (mirror of the DB CHECK).
- `LocationEditScreen` (leaf stack screen in BarberNavigator, BioEditScreen
  pattern: plain useEffect mount-fetch, save pops back to Studio): address
  input → debounced geocode → candidate list → confirm candidate → save.
  Mandatory consent copy: customers only ever see an approximate area, never
  the exact address. Explicit empty/no-match and network-failure states.
- Studio management card `barber-dashboard-location` (Bio card pattern).
- NOT in scope: readiness-meter 6th item (would touch isLive semantics —
  founder call, tracked as an open option, not built).

Run B (second pipeline run, after Run A's schema is live):
- Explore tab replaces the placeholder: filter chips (All / Available today /
  Under €100 / Verified), list view of existing BarberCards, map/list toggle.
- Chips are client-side refinements of an RLS-gated dataset — they hide rows
  from an already-authorized list, never widen access. No client-side authz.
  - Available today: batched `availability` read (`.in('barber_id', ids)`,
    existing `availability_select_own_or_approved` RLS), pure predicate
    "some window covers today (day_of_week or specific_date)".
  - Under €100: min service price < 100 via existing listServicesForBarberIds.
  - Verified: filters on the view's new `verified` column. FLAGGED: this is
    a no-op by construction today (every directory row is approved, and
    approved ⇒ verified in the absence of the tracked two-status drift). Built
    as decided, but the founders should expect it to select everything until
    a differentiating tier exists. Candidate future repurpose: "Top rated".
- Map: `@rnmapbox/maps`, price-pin markers ("€85" = real from-price) at
  DISPLAY coordinates only; `toMapPin()` returns null when either display
  coord is null (the honesty rule as code); docked BarberCard on pin tap.
- Native-module degrade (the current dev client does NOT include the module;
  the EAS build needs a founder-created secret `sk.` download token — EAS
  secret, never git): the map module is feature-detected at runtime; when
  absent, Explore forces list view and shows a calm "Map view arrives with
  the next app update" note. Never crashes, never blocks list view.

## Conditions (all binding)

- C1: exact address/lat/lng readable ONLY via own-row RLS on
  `barber_location`; grep-level guarantee that no other surface selects them.
- C2: trigger unconditionally overwrites display coords; redraw iff
  coordinates changed; NULL→NULL.
- C3: view adds only `verified, display_latitude, display_longitude`; LEFT
  JOIN; no exact columns.
- C4: migration is one idempotent ledgered file; schema-architect re-verifies
  zero-violating-rows at apply time (table is new — trivially true) and
  confirms the next free migration number against the live ledger.
- C5: `updateOwnLocation` writes only the four columns, keyed on the
  caller's own id; RLS sole authority (bio-edit C1 precedent).
- C6: LocationEditScreen is a leaf editor on plain useEffect (bio-edit C6).
- C7: geocoding failures/no-results are first-class UI states; token never
  logged; requests only over HTTPS.
- C8: Run B never fabricates a pin (null display coords ⇒ no marker), never
  invents client-side authz, and degrades without the native module.
- C9: Explore's directory read reuses the Discover data layer (one shared
  `barber_directory` read path — no second query shape for the same data).

## Verdict: APPROVED WITH CONDITIONS (C1–C9). Schema stage may proceed.

---

## Addendum — map-integration architect review (2026-07-15, applied manually)

Scope: the follow-up that turns Run B's map-soon state into the real map
(founder-provided sk. download token → EAS secret `RNMAPBOX_DOWNLOAD_TOKEN`;
`@rnmapbox/maps` ^10.3.2 installed; dynamic `app.config.js` injects the
config plugin ONLY when the env var is present so the token never touches
git and local tooling never breaks; new Android dev-client EAS build).

Reviewed against C1–C9 and the house patterns:

- **Import-safety boundary (the load-bearing decision):** the package THROWS
  at import time when its native side is absent (verified in its
  RNMBXModule.ts). `ExploreMapView.tsx` is the ONLY importer and is
  require()d exclusively behind `isMapNativeAvailable()`
  (`NativeModules.RNMBXModule != null` — the package's own check).
  ExploreScreen's compile-time reference is type-only (erased). The
  component header carries the never-static-import contract.
- **Privacy structure holds:** `ExploreMapPin` is built from
  `BarberDirectoryRow`, which cannot carry exact coordinates at the type or
  RLS level — the map is structurally incapable of rendering anything but
  the offset pair (C1/C3).
- **Chips govern both views:** pins derive from the FILTERED list — map and
  list can never disagree about who matches (C8: pure narrowing, no client
  authz).
- **Three-way map area** (soon / empty / real) keeps D4 absolute: no globe
  without pins, no fake pins, no crash on the old dev client.
- **Camera:** pure, unit-tested `pinBounds` (center for one pin, ne/sw box
  for several) via `defaultSettings` — DELIBERATE: filter changes do not
  yank the viewport; a list→map toggle remounts and re-fits.
- **Brand:** brass only on the ACTIVE pin; hairline pin chips on surface;
  serif/sans tokens; dark/light styleURL from the theme.

Verdict: **APPROVED**, with three recorded LOW notes: (L-a) a docked card
can overlap the Mapbox logo/attribution while open — check on-device and
offset `logoPosition` if it does (ToS nicety); (L-b) a missing
`EXPO_PUBLIC_MAPBOX_TOKEN` at runtime yields blank tiles (same
missing-config class as the geocoder's `missing_token`, documented, not
guarded further); (L-c) marker `allowOverlap` is fine at MVP density —
revisit clustering only if a city's pin count makes it unreadable.
