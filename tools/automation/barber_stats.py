"""Pure statistics behind the barber trust/planning components.

No I/O here — compute_barber_stats.py fetches rows and writes results; this
module only turns plain rows into numbers, so every rule is unit-tested
(test_barber_stats.py) and easy to reason about.

Methods, briefly:
  * Response time: minutes from a booking request to the barber's first
    accept/decline. Median (robust to the one request answered next week),
    capped at 48 h, published only with >= 3 samples.
  * Popular times: a 7 x 24 weekday/hour histogram of requested appointment
    starts over the last 120 days, with recency weighting (half-life 45 days)
    so last month matters more than last season, Bayesian shrinkage toward
    the marketplace-wide pattern (a barber with 3 bookings looks like the
    market, one with 300 looks like themselves), circular Gaussian smoothing
    over the hour axis, and normalisation to 0..1.
  * Repeat clients: share of a barber's completed-booking customers who
    completed at least twice; published with >= 4 customers.
"""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, Optional

RESPONSE_CAP_MIN = 48 * 60
MIN_RESPONSE_SAMPLES = 3
MIN_POPULAR_SAMPLES = 3
MIN_REPEAT_CUSTOMERS = 4
PRIOR_STRENGTH = 8.0
HALF_LIFE_DAYS = 45.0
SMOOTH_SIGMA_H = 1.0
WINDOW_DAYS = 120

Grid = list[list[float]]  # [weekday 0=Mon][hour 0..23]


@dataclass
class BookingRow:
    id: str
    barber_id: str
    customer_id: str
    day: date
    start: time
    status: str
    created_at: datetime


@dataclass
class DecisionRow:
    booking_id: str
    actor_id: Optional[str]
    decided_at: datetime


@dataclass
class BarberStats:
    barber_id: str
    median_response_minutes: Optional[int]
    response_samples: int
    popular_hours: Optional[Grid]
    popular_samples: int
    completed_count: int
    repeat_client_rate: Optional[float]

    def as_row(self, computed_at: datetime) -> dict:
        return {
            "barber_id": self.barber_id,
            "median_response_minutes": self.median_response_minutes,
            "response_samples": self.response_samples,
            "popular_hours": self.popular_hours,
            "popular_samples": self.popular_samples,
            "completed_count": self.completed_count,
            "repeat_client_rate": self.repeat_client_rate,
            "computed_at": computed_at.isoformat(),
        }


def empty_grid() -> Grid:
    return [[0.0] * 24 for _ in range(7)]


def response_minutes(bookings: Iterable[BookingRow], decisions: Iterable[DecisionRow]) -> dict[str, list[float]]:
    """Per barber: minutes from request to the barber's FIRST decision."""
    by_id = {b.id: b for b in bookings}
    first: dict[str, datetime] = {}
    for d in decisions:
        booking = by_id.get(d.booking_id)
        if booking is None or d.actor_id != booking.barber_id:
            continue  # system or customer actions are not barber responses
        if d.booking_id not in first or d.decided_at < first[d.booking_id]:
            first[d.booking_id] = d.decided_at
    out: dict[str, list[float]] = defaultdict(list)
    for booking_id, decided in first.items():
        booking = by_id[booking_id]
        minutes = (decided - booking.created_at).total_seconds() / 60
        if minutes >= 0:
            out[booking.barber_id].append(min(minutes, RESPONSE_CAP_MIN))
    return out


def median_minutes(samples: list[float]) -> Optional[int]:
    if len(samples) < MIN_RESPONSE_SAMPLES:
        return None
    return max(1, round(statistics.median(samples)))


def recency_weight(day: date, today: date) -> float:
    age = max(0, (today - day).days)
    return 0.5 ** (age / HALF_LIFE_DAYS)


def demand_grids(bookings: Iterable[BookingRow], today: date) -> tuple[dict[str, Grid], dict[str, int], Grid]:
    """Weighted per-barber grids, raw sample counts, and the market grid."""
    grids: dict[str, Grid] = defaultdict(empty_grid)
    counts: dict[str, int] = defaultdict(int)
    market = empty_grid()
    cutoff = today - timedelta(days=WINDOW_DAYS)
    for b in bookings:
        if b.status == "rejected" or b.day < cutoff:
            continue
        w = recency_weight(b.day, today)
        grids[b.barber_id][b.day.weekday()][b.start.hour] += w
        market[b.day.weekday()][b.start.hour] += w
        counts[b.barber_id] += 1
    return grids, counts, market


def smooth_hours(grid: Grid, sigma: float = SMOOTH_SIGMA_H) -> Grid:
    """Circular Gaussian blur along hours (23:00 neighbours 00:00)."""
    radius = max(1, math.ceil(3 * sigma))
    kernel = [math.exp(-(k * k) / (2 * sigma * sigma)) for k in range(-radius, radius + 1)]
    total = sum(kernel)
    kernel = [k / total for k in kernel]
    out = empty_grid()
    for d in range(7):
        for h in range(24):
            out[d][h] = sum(kernel[i] * grid[d][(h + i - radius) % 24] for i in range(len(kernel)))
    return out


def shrink(grid: Grid, market: Grid, strength: float = PRIOR_STRENGTH) -> Grid:
    """Posterior mean: barber mass plus `strength` pseudo-bookings shaped like the market."""
    market_total = sum(map(sum, market)) or 1.0
    return [[grid[d][h] + strength * market[d][h] / market_total for h in range(24)] for d in range(7)]


def normalise(grid: Grid) -> Grid:
    peak = max(max(row) for row in grid)
    if peak <= 0:
        return empty_grid()
    return [[round(v / peak, 3) for v in row] for row in grid]


def repeat_rate(bookings: Iterable[BookingRow]) -> tuple[dict[str, int], dict[str, Optional[float]]]:
    completed: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for b in bookings:
        if b.status == "completed":
            completed[b.barber_id][b.customer_id] += 1
    totals = {barber: sum(per.values()) for barber, per in completed.items()}
    rates: dict[str, Optional[float]] = {}
    for barber, per in completed.items():
        customers = len(per)
        rates[barber] = round(sum(1 for n in per.values() if n >= 2) / customers, 3) if customers >= MIN_REPEAT_CUSTOMERS else None
    return totals, rates


def compute_all(
    barber_ids: Iterable[str],
    bookings: list[BookingRow],
    decisions: list[DecisionRow],
    today: date,
) -> list[BarberStats]:
    responses = response_minutes(bookings, decisions)
    grids, counts, market = demand_grids(bookings, today)
    totals, rates = repeat_rate(bookings)
    out = []
    for barber in sorted(set(barber_ids)):
        n = counts.get(barber, 0)
        popular = normalise(smooth_hours(shrink(grids[barber], market))) if n >= MIN_POPULAR_SAMPLES else None
        samples = responses.get(barber, [])
        out.append(BarberStats(
            barber_id=barber,
            median_response_minutes=median_minutes(samples),
            response_samples=len(samples),
            popular_hours=popular,
            popular_samples=n,
            completed_count=totals.get(barber, 0),
            repeat_client_rate=rates.get(barber),
        ))
    return out


def parse_ts(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
