"""Place existing bookings on the map (one-off, founder-run).

Bookings created before migration 0049 have a text address but no
coordinates, so live arrival would have to geocode them at trip start. This
geocodes the open ones (pending / accepted, today or later) through free
Photon and -- only with --apply -- writes location_latitude/longitude.

Admin tool: needs the service_role key because booking coordinates are
frozen for app users (the freeze trigger lets service_role through by
design). The key is read from the environment ONLY, never from a file, and
never printed:

  PowerShell:  $env:SUPABASE_SERVICE_ROLE_KEY = '...'; py tools/geo/backfill_booking_coordinates.py
  bash:        SUPABASE_SERVICE_ROLE_KEY=... py tools/geo/backfill_booking_coordinates.py

Default is a dry run that prints what would be written. Add --apply to write.
Addresses are personal data: output shows booking ids and the matched place,
truncated, and nothing is saved to disk.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from routing_client import USER_AGENT  # noqa: E402
from simulate_trip import load_env  # noqa: E402

PHOTON_URL = os.environ.get("PRIVELIER_PHOTON_URL", "https://photon.komoot.io")


def photon_best(address: str):
    url = f"{PHOTON_URL}/api/?q={urllib.parse.quote(address)}&limit=1"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:
        features = json.loads(response.read()).get("features") or []
    if not features:
        return None
    lng, lat = features[0]["geometry"]["coordinates"][:2]
    props = features[0].get("properties", {})
    label = ", ".join(str(p) for p in (props.get("name"), props.get("street"), props.get("city")) if p)
    return lat, lng, label


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write coordinates (default: dry run)")
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        sys.exit("Set SUPABASE_SERVICE_ROLE_KEY in the environment for this one run (never in a file).")
    url, _anon = load_env()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    today = dt.date.today().isoformat()
    query = (
        f"/rest/v1/bookings?select=id,location&location_latitude=is.null"
        f"&status=in.(pending,accepted)&date=gte.{today}&order=date.asc&limit={args.limit}"
    )
    with urllib.request.urlopen(urllib.request.Request(url + query, headers=headers), timeout=30) as response:
        rows = json.loads(response.read())
    print(f"{len(rows)} open bookings without coordinates.")

    placed = 0
    for row in rows:
        time.sleep(1.1)  # Photon fair use
        try:
            match = photon_best(row["location"])
        except Exception as exc:  # network hiccup: skip, never abort the batch
            print(f"  {row['id'][:8]}  skipped ({exc.__class__.__name__})")
            continue
        if not match:
            print(f"  {row['id'][:8]}  no match")
            continue
        lat, lng, label = match
        print(f"  {row['id'][:8]}  -> {label[:48]}  ({lat:.5f}, {lng:.5f})")
        if args.apply:
            body = json.dumps({"location_latitude": lat, "location_longitude": lng}).encode()
            request = urllib.request.Request(
                f"{url}/rest/v1/bookings?id=eq.{row['id']}", data=body, method="PATCH",
                headers={**headers, "Prefer": "return=minimal"},
            )
            urllib.request.urlopen(request, timeout=20).close()
        placed += 1

    verb = "Wrote" if args.apply else "Would write"
    print(f"{verb} coordinates for {placed}/{len(rows)} bookings.{'' if args.apply else ' Re-run with --apply.'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
