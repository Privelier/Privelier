"""Nightly job: compute barber_stats (migration 0050) from live data.

Runs on GitHub Actions (.github/workflows/barber-stats.yml) — free, no
server to maintain — or locally. Reads bookings and booking-decision
notifications with the service_role key and upserts one aggregate row per
barber. The statistics live in barber_stats.py (pure, unit-tested).

Environment (never files) — either backend works:
  SUPABASE_URL + SUPABASE_SECRET_KEY         PostgREST with the sb_secret_ key (GitHub Actions);
                                             the legacy SUPABASE_SERVICE_ROLE_KEY JWT still works
  SUPABASE_ACCESS_TOKEN                      founder's personal access token: same job via the
                                             Supabase Management API (handy locally)

Usage:
  py tools/automation/compute_barber_stats.py            # compute + write
  py tools/automation/compute_barber_stats.py --dry-run  # compute + print summary only
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from barber_stats import WINDOW_DAYS, BookingRow, DecisionRow, compute_all, parse_ts  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
PAGE = 1000


def supabase_url() -> str:
    url = os.environ.get("SUPABASE_URL")
    if not url:
        env = REPO / ".env"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.startswith("EXPO_PUBLIC_SUPABASE_URL="):
                    url = line.split("=", 1)[1].strip().strip('"')
    if not url:
        sys.exit("SUPABASE_URL is not set.")
    return url.rstrip("/")


class Rest:
    def __init__(self, url: str, key: str):
        self.url = url
        self.headers = {"apikey": key, "Content-Type": "application/json"}
        # New sb_secret_ keys go in `apikey` only (they are not JWTs); a
        # legacy service_role JWT is also sent as the bearer token.
        if not key.startswith("sb_"):
            self.headers["Authorization"] = f"Bearer {key}"

    def get_all(self, path: str) -> list[dict]:
        rows: list[dict] = []
        offset = 0
        while True:
            sep = "&" if "?" in path else "?"
            request = urllib.request.Request(f"{self.url}/rest/v1/{path}{sep}limit={PAGE}&offset={offset}", headers=self.headers)
            with urllib.request.urlopen(request, timeout=60) as response:
                page = json.loads(response.read())
            rows.extend(page)
            if len(page) < PAGE:
                return rows
            offset += PAGE

    def upsert(self, table: str, rows: list[dict]) -> None:
        for i in range(0, len(rows), 500):
            body = json.dumps(rows[i:i + 500]).encode()
            request = urllib.request.Request(
                f"{self.url}/rest/v1/{table}?on_conflict=barber_id", data=body, method="POST",
                headers={**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            urllib.request.urlopen(request, timeout=60).close()


class Management:
    """Same reads/writes through the Management API's SQL endpoint (PAT auth)."""

    def __init__(self, url: str, token: str):
        self.ref = url.split("//", 1)[1].split(".", 1)[0]
        self.token = token

    def _sql(self, query: str):
        request = urllib.request.Request(
            f"https://api.supabase.com/v1/projects/{self.ref}/database/query",
            data=json.dumps({"query": query}).encode(), method="POST",
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json", "User-Agent": "privelier-stats/1.0"},
        )
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read() or b"[]")

    def read(self, since: str):
        barbers = self._sql("select user_id from public.barber_profile")
        bookings = self._sql(
            "select id, barber_id, customer_id, date::text as date, time::text as time, status::text as status, created_at::text as created_at "
            f"from public.bookings where date >= '{since}'::date"
        )
        decisions = self._sql(
            "select booking_id, actor_id, created_at::text as created_at from public.notifications "
            f"where event_type = 'booking_status' and booking_status in ('accepted','rejected') and created_at >= '{since}'::date"
        )
        return barbers, bookings, decisions

    def upsert(self, rows: list[dict]) -> None:
        payload = json.dumps(rows).replace("'", "''")
        self._sql(
            "insert into public.barber_stats (barber_id, median_response_minutes, response_samples, popular_hours, "
            "popular_samples, completed_count, repeat_client_rate, computed_at) "
            "select barber_id, median_response_minutes, response_samples, popular_hours, popular_samples, completed_count, "
            f"repeat_client_rate, computed_at from jsonb_to_recordset('{payload}'::jsonb) as r(barber_id uuid, "
            "median_response_minutes int, response_samples int, popular_hours jsonb, popular_samples int, completed_count int, "
            "repeat_client_rate real, computed_at timestamptz) "
            "on conflict (barber_id) do update set median_response_minutes = excluded.median_response_minutes, "
            "response_samples = excluded.response_samples, popular_hours = excluded.popular_hours, "
            "popular_samples = excluded.popular_samples, completed_count = excluded.completed_count, "
            "repeat_client_rate = excluded.repeat_client_rate, computed_at = excluded.computed_at"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    pat = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not key and not pat:
        # On a fork or before the secret exists this is a no-op, not a failure.
        print("::notice::No SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ACCESS_TOKEN — skipping barber stats.")
        return 0
    today = datetime.now(timezone.utc).date()
    since = (today - timedelta(days=WINDOW_DAYS + 30)).isoformat()

    backend = Rest(supabase_url(), key) if key else Management(supabase_url(), pat or "")
    try:
        if isinstance(backend, Rest):
            barbers = backend.get_all("barber_profile?select=user_id")
            raw_bookings = backend.get_all(f"bookings?select=id,barber_id,customer_id,date,time,status,created_at&date=gte.{since}")
            raw_decisions = backend.get_all(
                "notifications?select=booking_id,actor_id,created_at"
                f"&event_type=eq.booking_status&booking_status=in.(accepted,rejected)&created_at=gte.{since}"
            )
        else:
            barbers, raw_bookings, raw_decisions = backend.read(since)
    except urllib.error.HTTPError as exc:
        sys.exit(f"Read failed: HTTP {exc.code} {exc.read().decode(errors='replace')[:200]}")

    bookings = [
        BookingRow(
            id=r["id"], barber_id=r["barber_id"], customer_id=r["customer_id"],
            day=date.fromisoformat(r["date"]), start=time.fromisoformat(r["time"]),
            status=r["status"], created_at=parse_ts(r["created_at"]),
        )
        for r in raw_bookings
    ]
    # Notifications are one row per recipient; dedupe to one decision per booking.
    decisions = [DecisionRow(r["booking_id"], r.get("actor_id"), parse_ts(r["created_at"])) for r in raw_decisions]

    stats = compute_all([b["user_id"] for b in barbers], bookings, decisions, today)
    with_response = sum(1 for s in stats if s.median_response_minutes is not None)
    with_popular = sum(1 for s in stats if s.popular_hours is not None)
    print(f"{len(stats)} barbers · {len(bookings)} bookings · response time for {with_response} · popular times for {with_popular}")

    if args.dry_run:
        for s in stats[:10]:
            print(f"  {s.barber_id[:8]}  reply~{s.median_response_minutes} min (n={s.response_samples})  "
                  f"popular n={s.popular_samples}  completed={s.completed_count}  repeat={s.repeat_client_rate}")
        return 0

    computed_at = datetime.now(timezone.utc)
    rows = [s.as_row(computed_at) for s in stats]
    if isinstance(backend, Rest):
        backend.upsert("barber_stats", rows)
    else:
        backend.upsert(rows)
    print("barber_stats updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
