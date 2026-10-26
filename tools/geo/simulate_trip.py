"""Drive a fake barber to a real booking -- test live tracking from your desk.

Signs in as a TEST BARBER (ordinary email/password auth, the anon key from
.env -- never the service_role key), then plays a realistic drive along a
real road route: start_trip, a position update every simulated 5 s with GPS
noise and red-light stops, and mark_trip_arrived at the door. The customer
app shows the moving marker, the countdown, and receives the "on the way",
"almost there" and "arrived" notifications/pushes exactly as in real life.

ETAs are computed by geo_core.TripEngine -- the same algorithm as the app.

Requirements (enforced by the database, migration 0049):
  - the booking belongs to the signed-in barber and is ACCEPTED;
  - it is dated within one day of today.

Usage:
  py tools/geo/simulate_trip.py --booking-id <uuid>
  py tools/geo/simulate_trip.py --booking-id <uuid> --from 11.0640,49.4480 --speed 8
  py tools/geo/simulate_trip.py --booking-id <uuid> --dry-run    # no writes, print the timeline

Credentials: PRIVELIER_SIM_EMAIL / PRIVELIER_SIM_PASSWORD, else prompted.
Ctrl-C at any time ends the trip (end_trip wipes the position).
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from geo_core import (  # noqa: E402
    EtaCalibration,
    GpsFix,
    TripEngine,
    bearing_deg,
    cumulative_distances,
    destination_point,
    encode_polyline,
    estimate_trip,
    haversine_m,
)
from routing_client import route as fetch_route  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SERVER_MIN_INTERVAL_S = 2.2  # update_trip_position accepts one fix per 2 s


def load_env() -> tuple[str, str]:
    values = {}
    env_file = REPO / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip().strip('"').strip("'")
    url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or values.get("EXPO_PUBLIC_SUPABASE_URL")
    anon = os.environ.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or values.get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if not url or not anon:
        sys.exit("EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing (.env).")
    return url.rstrip("/"), anon


class Supabase:
    def __init__(self, url: str, anon: str):
        self.url, self.anon, self.jwt = url, anon, None

    def _call(self, method: str, path: str, body=None, auth=True):
        headers = {"apikey": self.anon, "Content-Type": "application/json"}
        if auth and self.jwt:
            headers["Authorization"] = f"Bearer {self.jwt}"
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.url + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            raise SystemExit(f"{method} {path.split('?')[0]} -> HTTP {exc.code}: {detail[:300]}") from None

    def sign_in(self, email: str, password: str):
        data = self._call("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": password}, auth=False)
        self.jwt = data["access_token"]

    def rpc(self, name: str, args: dict):
        return self._call("POST", f"/rest/v1/rpc/{name}", args)

    def booking(self, booking_id: str):
        rows = self._call("GET", f"/rest/v1/bookings?id=eq.{booking_id}&select=id,status,date,location,location_latitude,location_longitude")
        return rows[0] if rows else None


def parse_lnglat(text: str):
    lng, lat = (float(v) for v in text.split(","))
    return (lng, lat)


def drive_samples(route_coords, speed_mps, step_s, noise_m, rng):
    """Yields (true position, reported fix, speed) every step along the route."""
    cum = cumulative_distances(route_coords)
    total = cum[-1]
    lights = sorted(rng.uniform(0.15, 0.85) * total for _ in range(max(1, int(total // 1500))))
    along, light_wait = 0.0, 0.0
    seg = 0
    while along < total:
        if lights and along >= lights[0] and light_wait <= 0:
            light_wait = rng.uniform(20, 55)
            lights.pop(0)
        moving = light_wait <= 0
        if moving:
            along = min(total, along + speed_mps * rng.uniform(0.8, 1.15) * step_s)
        else:
            light_wait -= step_s
        while seg < len(cum) - 2 and cum[seg + 1] < along:
            seg += 1
        a, b = route_coords[seg], route_coords[seg + 1]
        k = 0 if cum[seg + 1] == cum[seg] else (along - cum[seg]) / (cum[seg + 1] - cum[seg])
        true_pos = (a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1]))
        noisy = destination_point(true_pos, rng.uniform(0, 360), abs(rng.gauss(0, noise_m)))
        yield true_pos, noisy, (speed_mps if moving else 0.0), bearing_deg(a, b)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--booking-id", required=True)
    parser.add_argument("--from", dest="origin", help="start as lng,lat (default: 2-4 km from the address)")
    parser.add_argument("--dest", help="override destination lng,lat (for bookings without coordinates)")
    parser.add_argument("--speed", type=float, default=6.0, help="time compression factor (6 = 6x real time)")
    parser.add_argument("--noise-m", type=float, default=6.0, help="GPS noise standard deviation")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    rng = random.Random(args.seed)

    sb = Supabase(*load_env())
    booking = None
    if not args.dry_run or not args.dest:
        email = os.environ.get("PRIVELIER_SIM_EMAIL") or input("Test barber email: ")
        password = os.environ.get("PRIVELIER_SIM_PASSWORD") or getpass.getpass("Password: ")
        sb.sign_in(email, password)
        booking = sb.booking(args.booking_id)
        if not booking:
            sys.exit("Booking not visible to this barber.")
        if booking["status"] != "accepted":
            sys.exit(f"Booking is '{booking['status']}' -- trips need an accepted booking.")

    if args.dest:
        dest = parse_lnglat(args.dest)
    elif booking and booking.get("location_latitude") is not None:
        dest = (booking["location_longitude"], booking["location_latitude"])
    else:
        sys.exit("Booking has no coordinates; pass --dest lng,lat.")

    origin = parse_lnglat(args.origin) if args.origin else destination_point(dest, rng.uniform(0, 360), rng.uniform(2000, 4000))
    road = fetch_route(origin, dest)
    calibration = EtaCalibration.load()
    trip_route = road or estimate_trip(origin, dest, calibration)
    print(f"Route: {trip_route.source}, {trip_route.distance_m / 1000:.2f} km, router ETA {trip_route.duration_s / 60:.1f} min")

    clock = {"t": 0.0}
    engine = TripEngine(trip_route, dest, calibration, now_ms=lambda: clock["t"] * 1000)
    first = engine.update(GpsFix(origin, 0, accuracy_m=8))
    polyline = encode_polyline(trip_route.coordinates)

    if not args.dry_run:
        sb.rpc("start_trip", {
            "p_booking_id": args.booking_id, "p_latitude": origin[1], "p_longitude": origin[0],
            "p_dest_latitude": dest[1], "p_dest_longitude": dest[0], "p_route_polyline": polyline,
            "p_route_source": trip_route.source, "p_remaining_distance_m": round(first.remaining_m),
            "p_eta_seconds": first.eta_s,
        })
        print("Trip started -- the customer now sees 'on the way'.")

    step_s = 5.0
    real_interval = max(SERVER_MIN_INTERVAL_S, step_s / args.speed)
    drive_speed = trip_route.distance_m / trip_route.duration_s / 1.1 if trip_route.duration_s else 8
    try:
        for true_pos, fix, speed, heading in drive_samples(trip_route.coordinates, drive_speed, step_s, args.noise_m, rng):
            clock["t"] += step_s
            snap = engine.update(GpsFix(fix, clock["t"] * 1000, speed, max(5.0, args.noise_m * 1.5), heading))
            if snap.should_reroute:
                engine.mark_reroute_requested()
            print(
                f"t={clock['t']:6.0f}s  left {snap.remaining_m:7.0f} m  eta {snap.eta_s / 60:5.1f} min  "
                f"pace x{snap.pace_factor:.2f}  {'STOP ' if speed == 0 else ''}{'OFF-ROUTE ' if snap.off_route else ''}"
            )
            if not args.dry_run:
                sb.rpc("update_trip_position", {
                    "p_booking_id": args.booking_id, "p_latitude": fix[1], "p_longitude": fix[0],
                    "p_heading": heading if speed > 0 else None, "p_speed_mps": speed,
                    "p_accuracy_m": args.noise_m * 1.5, "p_remaining_distance_m": round(snap.remaining_m),
                    "p_eta_seconds": snap.eta_s,
                })
                time.sleep(real_interval)
            if snap.arrived or haversine_m(true_pos, dest) < 25:
                break
        if not args.dry_run:
            sb.rpc("mark_trip_arrived", {"p_booking_id": args.booking_id})
        print(f"Arrived after {clock['t'] / 60:.1f} simulated minutes.")
    except KeyboardInterrupt:
        if not args.dry_run:
            sb.rpc("end_trip", {"p_booking_id": args.booking_id})
        print("\nStopped -- trip ended and position wiped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
