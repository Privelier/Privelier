# Location stack and geo tooling

Privelier's maps, address search, routing, live arrival and push run on free,
keyless services, so a growing user count never brings a map bill. Live trips
are coordinated through the existing Supabase backend (migration 0049); no
extra server is involved.

| Job | Service | Cost / key | Self-host later via |
| --- | --- | --- | --- |
| Map tiles + style | OpenFreeMap (OpenStreetMap data), MapLibre renderer | free, no key, no quota | `tiles.openfreemap.org` is replaceable by any OpenMapTiles host |
| Address search | Photon (komoot) | free, fair use | `EXPO_PUBLIC_PHOTON_URL` |
| Road routing | FOSSGIS OSRM, then FOSSGIS Valhalla | free, fair use | `EXPO_PUBLIC_OSRM_URL`, `EXPO_PUBLIC_VALHALLA_URL` |
| Offline ETA | calibrated straight-line model (this folder) | none | — |
| Push | Expo push service, called from Postgres via `pg_net` | free | — |

**Why the fair-use servers are enough at this scale:** a trip makes 1 route
request at start plus a re-route only when the barber leaves the route
(throttled to one per 30 s). ETA updates are computed on the barber's phone,
so they cost no requests. Address search is debounced. If Privelier ever
outgrows fair use, run OSRM and Photon in Docker on any small VM and set the
env vars above. No code changes are needed.

## How a live trip works

1. The barber taps **I'm on my way** on an accepted booking. The app asks for
   "while using" location permission at that moment and never earlier.
2. The barber app fetches a road route and calls `start_trip`. The customer
   gets the *on the way* notification and push.
3. GPS fixes go through `TripEngine` (`src/shared/tracking/eta.ts`), which:
   - snaps each fix to the route
   - learns a pace factor from the actual drive
   - smooths the ETA
   - detects going off-route and triggers a re-route
   - detects arrival
4. Updates are sent through `update_trip_position`: at most every 5 s, and
   only when the barber moved 20 m or 15 s passed. The **server** fires
   *almost there* once the ETA reaches 5 min or 800 m remain.
5. On arrival (automatic, or "I've arrived") the customer gets *arrived*.
   Stopping, completing or cancelling **wipes every coordinate**. Only the
   latest position is ever stored; there is no history.

## Python tools (standard library only, Python 3.10+)

```bash
py tools/geo/test_geo_core.py                 # reference-engine tests (+ --regen for fixtures)
py tools/geo/calibrate_eta.py                 # refit the offline ETA from real routes
py tools/geo/simulate_trip.py --booking-id …  # drive a fake barber to a real booking
py tools/geo/backfill_booking_coordinates.py  # place pre-0049 bookings (dry run; --apply)
```

- **`geo_core.py`** mirrors `geo.ts` and `eta.ts` line for line. Both are
  checked against `fixtures/geo_vectors.json`
  (`src/shared/tracking/__tests__/geo.test.ts` on the app side), so the
  tooling and the app agree exactly, including a 64-step scripted drive with
  a red light, a GPS glitch and an arrival dwell.
- **`calibrate_eta.py`** samples real road routes in several cities and
  regenerates `src/shared/tracking/etaCalibration.generated.ts`. Only the
  offline fallback uses those numbers.
- **`simulate_trip.py`** signs in as a *test barber* (anon key, never
  `service_role`) and plays a realistic drive, so tracking, the countdown and
  the notifications can be checked on a customer device without driving.
  `--dry-run` prints the ETA timeline only.
- **`backfill_booking_coordinates.py`** is a one-off admin script. The
  `service_role` key comes from the environment for that run only.
