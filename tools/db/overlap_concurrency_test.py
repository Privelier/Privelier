"""Concurrency proof for bookings_no_overlapping_active_slot (migration 0054).

Four real database sessions through the Management API, none of which
commits (each request's open transaction is rolled back when it ends):

  A  inserts barber R's 10:00-11:00 booking, then holds its transaction open.
  B  meanwhile inserts R's overlapping 10:30 booking with a 2 s lock timeout:
     it must be refused while A's row is in flight (no race window).
  C  meanwhile inserts R's adjacent 11:00 booking: it must succeed at once
     (half-open [start, end) ranges do not conflict).
  D  after A has rolled back, retries B's booking: it must now succeed,
     proving A's in-flight row was the only reason B was refused.

session_replication_role = replica turns triggers (including foreign-key
checks) off inside each transaction, so random ids need no fixture rows;
the exclusion constraint is not a trigger and stays enforced.

  python tools/db/overlap_concurrency_test.py
"""
from __future__ import annotations

import sys
import threading
import time
import uuid

from supa import run

BARBER = str(uuid.uuid4())
DAY = "current_date + 30"


def insert(start: str, hold_seconds: float = 0, lock_timeout: str | None = None) -> str:
    sql = "begin; set local session_replication_role = replica;"
    if lock_timeout:
        sql += f" set local lock_timeout = '{lock_timeout}';"
    sql += (
        " insert into public.bookings (customer_id, barber_id, service_id, date, time, location, price, duration_minutes)"
        f" values (gen_random_uuid(), '{BARBER}', gen_random_uuid(), {DAY}, '{start}', 'concurrency test', 1, 60);"
    )
    if hold_seconds:
        sql += f" select pg_sleep({hold_seconds});"
    sql += " select 'inserted' as outcome;"
    try:
        run(sql)
        return "inserted"
    except RuntimeError as error:
        text = str(error)
        if "lock timeout" in text or "55P03" in text:
            return "refused: waited on the in-flight overlapping row (lock timeout)"
        if "23P01" in text or "exclusion" in text:
            return "refused: exclusion constraint"
        return "error: " + text[:200]


def main() -> None:
    results: dict[str, tuple[str, float]] = {}

    def timed(name: str, *args, **kwargs) -> None:
        started = time.monotonic()
        results[name] = (insert(*args, **kwargs), time.monotonic() - started)

    holder = threading.Thread(target=timed, args=("A", "10:00"), kwargs={"hold_seconds": 8})
    holder.start()
    time.sleep(3)  # A's row is now inserted and uncommitted.
    contenders = [
        threading.Thread(target=timed, args=("B", "10:30"), kwargs={"lock_timeout": "2s"}),
        threading.Thread(target=timed, args=("C", "11:00"), kwargs={"lock_timeout": "2s"}),
    ]
    for thread in contenders:
        thread.start()
    for thread in contenders:
        thread.join()
    holder.join()
    timed("D", "10:30", lock_timeout="2s")

    for name in "ABCD":
        outcome, seconds = results[name]
        print(f"{name}  {outcome}  ({seconds:.1f} s)")

    passed = (
        results["A"][0] == "inserted"
        and results["B"][0].startswith("refused")
        and results["C"][0] == "inserted"
        and results["D"][0] == "inserted"
    )
    print("PASS" if passed else "FAIL")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
