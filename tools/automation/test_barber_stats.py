"""py tools/automation/test_barber_stats.py"""

from __future__ import annotations

import sys
import unittest
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from barber_stats import (  # noqa: E402
    BookingRow,
    DecisionRow,
    compute_all,
    median_minutes,
    normalise,
    recency_weight,
    shrink,
    smooth_hours,
    empty_grid,
)

TODAY = date(2026, 10, 25)
T0 = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)


def booking(i, barber="B", customer="C", day=TODAY - timedelta(days=3), start=time(18), status="completed", created=T0):
    return BookingRow(f"bk{i}", barber, customer, day, start, status, created)


class StatsTests(unittest.TestCase):
    def test_median_needs_three_samples_and_ignores_outliers(self):
        self.assertIsNone(median_minutes([5, 10]))
        self.assertEqual(median_minutes([5, 12, 2880]), 12)

    def test_response_uses_first_barber_decision_only(self):
        bookings = [booking(1), booking(2), booking(3)]
        decisions = [
            DecisionRow("bk1", "B", T0 + timedelta(minutes=10)),
            DecisionRow("bk1", "B", T0 + timedelta(minutes=99)),   # later duplicate (2nd recipient row)
            DecisionRow("bk2", "C", T0 + timedelta(minutes=1)),    # customer action: not a response
            DecisionRow("bk2", "B", T0 + timedelta(minutes=20)),
            DecisionRow("bk3", "B", T0 + timedelta(minutes=30)),
        ]
        [stats] = compute_all(["B"], bookings, decisions, TODAY)
        self.assertEqual(stats.response_samples, 3)
        self.assertEqual(stats.median_response_minutes, 20)

    def test_recency_half_life(self):
        self.assertAlmostEqual(recency_weight(TODAY, TODAY), 1.0)
        self.assertAlmostEqual(recency_weight(TODAY - timedelta(days=45), TODAY), 0.5, places=6)

    def test_smoothing_wraps_midnight_and_preserves_mass(self):
        grid = empty_grid()
        grid[0][0] = 1.0
        out = smooth_hours(grid)
        self.assertGreater(out[0][23], 0)
        self.assertGreater(out[0][1], 0)
        self.assertAlmostEqual(sum(out[0]), 1.0, places=6)

    def test_shrinkage_pulls_sparse_barbers_to_market_shape(self):
        market = empty_grid()
        market[2][10] = 100.0  # market: Wednesdays at 10
        sparse = empty_grid()
        sparse[5][20] = 1.0    # one Saturday-evening booking
        posterior = normalise(shrink(sparse, market))
        self.assertEqual(posterior[2][10], 1.0)  # market dominates one booking
        busy = empty_grid()
        busy[5][20] = 60.0
        self.assertEqual(normalise(shrink(busy, market))[5][20], 1.0)  # lots of data: own pattern wins

    def test_popular_times_and_repeat_rate_thresholds(self):
        few = [booking(i, customer=f"c{i}") for i in range(2)]
        [stats] = compute_all(["B"], few, [], TODAY)
        self.assertIsNone(stats.popular_hours)
        self.assertIsNone(stats.repeat_client_rate)

        many = [booking(i, customer=f"c{i % 4}") for i in range(6)]  # 4 customers, 2 of them twice
        [stats] = compute_all(["B"], many, [], TODAY)
        self.assertEqual(len(stats.popular_hours), 7)
        self.assertEqual(len(stats.popular_hours[0]), 24)
        peak_day = (TODAY - timedelta(days=3)).weekday()
        self.assertEqual(stats.popular_hours[peak_day][18], 1.0)
        self.assertEqual(stats.repeat_client_rate, 0.5)
        self.assertEqual(stats.completed_count, 6)

    def test_rejected_and_old_bookings_do_not_count_as_demand(self):
        rows = [booking(i, status="rejected") for i in range(5)] + [booking(9, day=TODAY - timedelta(days=400))]
        [stats] = compute_all(["B"], rows, [], TODAY)
        self.assertEqual(stats.popular_samples, 0)

    def test_barbers_without_data_still_get_a_row(self):
        stats = compute_all(["A", "B"], [], [], TODAY)
        self.assertEqual([s.barber_id for s in stats], ["A", "B"])
        self.assertTrue(all(s.median_response_minutes is None for s in stats))


if __name__ == "__main__":
    unittest.main(verbosity=1)
