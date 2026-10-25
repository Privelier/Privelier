"""Tests for geo_core.py plus the cross-language fixture.

  py tools/geo/test_geo_core.py            # run tests
  py tools/geo/test_geo_core.py --regen    # rewrite fixtures/geo_vectors.json

The fixture is consumed unchanged by src/shared/tracking/__tests__/geo.test.ts,
so a passing run on both sides proves the Python tooling and the app agree.
Only regenerate after an intentional algorithm change, and update both
implementations in the same commit.
"""

from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from geo_core import (  # noqa: E402
    EtaCalibration,
    GpsFix,
    SpeedBand,
    TripEngine,
    TripRoute,
    bearing_deg,
    cumulative_distances,
    decode_polyline,
    destination_point,
    encode_polyline,
    estimate_trip,
    haversine_m,
    project_onto_route,
)

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "geo_vectors.json"

# Fixed calibration for the fixture: independent of whatever the generated
# app calibration currently holds.
FIXTURE_CALIBRATION = EtaCalibration(
    detour_factor=1.4,
    speed_bands=[SpeedBand(2000, 6.0), SpeedBand(5000, 7.0), SpeedBand(1e12, 8.5)],
    fixed_overhead_s=90,
)

HAUPTMARKT = (11.0772, 49.4547)
PLAERRER = (11.0640, 49.4480)
ROUTE = [
    (11.0640, 49.4480), (11.0665, 49.4489), (11.0690, 49.4501),
    (11.0712, 49.4515), (11.0735, 49.4526), (11.0752, 49.4537), (11.0772, 49.4547),
]


def scripted_drive():
    """A 1.3 km drive with a GPS detour, a red light and an arrival dwell."""
    route_m = cumulative_distances(ROUTE)[-1]
    route = TripRoute(list(ROUTE), route_m, route_m / 7.0, "osrm")
    fixes = []
    t = 0.0
    cum = cumulative_distances(ROUTE)

    def point_at(along):
        for i in range(len(ROUTE) - 1):
            if cum[i + 1] >= along:
                k = (along - cum[i]) / (cum[i + 1] - cum[i])
                a, b = ROUTE[i], ROUTE[i + 1]
                return (a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1]))
        return ROUTE[-1]

    along = 0.0
    light_left_s = 60  # one red light after ~400 m
    while along < route_m - 25:
        at_light = along >= 400 and light_left_s > 0
        speed = 0.0 if at_light else 6.0
        pos = point_at(along)
        if 700 <= along < 790:  # 3 noisy fixes 80 m off the road
            pos = destination_point(pos, 0, 80)
        fixes.append({"position": list(pos), "timestampMs": t * 1000, "speedMps": speed, "accuracyM": 10})
        t += 5
        if at_light:
            light_left_s -= 5
        else:
            along += 30
    for _ in range(12):  # parked 60 m short of the door, walking pace
        pos = destination_point(HAUPTMARKT, 200, 60)
        fixes.append({"position": list(pos), "timestampMs": t * 1000, "speedMps": 0.5, "accuracyM": 8})
        t += 5
    return route, fixes


def run_drive(route, fixes):
    clock = {"now": 0.0}
    engine = TripEngine(route, HAUPTMARKT, FIXTURE_CALIBRATION, now_ms=lambda: clock["now"])
    out = []
    for f in fixes:
        clock["now"] = f["timestampMs"]
        snap = engine.update(GpsFix(tuple(f["position"]), f["timestampMs"], f["speedMps"], f["accuracyM"]))
        if snap.should_reroute:
            engine.mark_reroute_requested()
        out.append({
            "remainingM": round(snap.remaining_m, 3),
            "etaS": snap.eta_s,
            "progress": round(snap.progress, 5),
            "offRoute": snap.off_route,
            "shouldReroute": snap.should_reroute,
            "arrived": snap.arrived,
        })
    return out


def build_fixture():
    route, fixes = scripted_drive()
    encoded = encode_polyline(ROUTE, 6)
    proj = project_onto_route((11.0700, 49.4512), ROUTE)
    est = estimate_trip(PLAERRER, HAUPTMARKT, FIXTURE_CALIBRATION)
    return {
        "haversine": [
            {"a": list(PLAERRER), "b": list(HAUPTMARKT), "meters": haversine_m(PLAERRER, HAUPTMARKT)},
            {"a": [0, 0], "b": [1, 0], "meters": haversine_m((0, 0), (1, 0))},
            {"a": [-0.1278, 51.5074], "b": [2.3522, 48.8566], "meters": haversine_m((-0.1278, 51.5074), (2.3522, 48.8566))},
        ],
        "bearing": [
            {"a": [0, 0], "b": [0, 1], "degrees": bearing_deg((0, 0), (0, 1))},
            {"a": list(PLAERRER), "b": list(HAUPTMARKT), "degrees": bearing_deg(PLAERRER, HAUPTMARKT)},
        ],
        "polyline": {"line": [list(p) for p in ROUTE], "encoded6": encoded},
        "projection": {
            "fix": [11.0700, 49.4512],
            "route": [list(p) for p in ROUTE],
            "segmentIndex": proj.segment_index,
            "alongM": proj.along_m,
            "crossTrackM": proj.cross_track_m,
        },
        "estimate": {
            "from": list(PLAERRER), "to": list(HAUPTMARKT),
            "calibration": {
                "detourFactor": FIXTURE_CALIBRATION.detour_factor,
                "speedBands": [{"maxDistanceM": b.max_distance_m, "speedMps": b.speed_mps} for b in FIXTURE_CALIBRATION.speed_bands],
                "fixedOverheadS": FIXTURE_CALIBRATION.fixed_overhead_s,
            },
            "distanceM": est.distance_m, "durationS": est.duration_s,
        },
        "drive": {
            "destination": list(HAUPTMARKT),
            "route": {"coordinates": [list(p) for p in ROUTE], "distanceM": route.distance_m, "durationS": route.duration_s, "source": "osrm"},
            "fixes": fixes,
            "expected": run_drive(route, fixes),
        },
    }


class GeoCoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fx = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_haversine_known_distances(self):
        # 1 degree of longitude at the equator ~ 111.195 km.
        self.assertAlmostEqual(haversine_m((0, 0), (1, 0)), 111_195, delta=5)
        # London -> Paris ~ 343.5 km.
        self.assertAlmostEqual(haversine_m((-0.1278, 51.5074), (2.3522, 48.8566)) / 1000, 343.5, delta=1)

    def test_fixture_haversine_and_bearing(self):
        for v in self.fx["haversine"]:
            self.assertAlmostEqual(haversine_m(tuple(v["a"]), tuple(v["b"])), v["meters"], places=6)
        for v in self.fx["bearing"]:
            self.assertAlmostEqual(bearing_deg(tuple(v["a"]), tuple(v["b"])), v["degrees"], places=6)

    def test_polyline_round_trip(self):
        p = self.fx["polyline"]
        self.assertEqual(encode_polyline([tuple(x) for x in p["line"]], 6), p["encoded6"])
        decoded = decode_polyline(p["encoded6"], 6)
        for got, want in zip(decoded, p["line"]):
            self.assertAlmostEqual(got[0], want[0], places=6)
            self.assertAlmostEqual(got[1], want[1], places=6)
        # Classic Google precision-5 example.
        self.assertEqual(
            decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5),
            [(-120.2, 38.5), (-120.95, 40.7), (-126.453, 43.252)],
        )

    def test_truncated_polyline_keeps_complete_points(self):
        self.assertEqual(decode_polyline("_p~iF~ps|U_ulL", 5), [(-120.2, 38.5)])

    def test_projection(self):
        p = self.fx["projection"]
        proj = project_onto_route(tuple(p["fix"]), [tuple(x) for x in p["route"]])
        self.assertEqual(proj.segment_index, p["segmentIndex"])
        self.assertAlmostEqual(proj.along_m, p["alongM"], places=6)
        self.assertAlmostEqual(proj.cross_track_m, p["crossTrackM"], places=6)
        self.assertLess(proj.cross_track_m, 60)

    def test_estimate(self):
        e = self.fx["estimate"]
        est = estimate_trip(tuple(e["from"]), tuple(e["to"]), FIXTURE_CALIBRATION)
        self.assertAlmostEqual(est.distance_m, e["distanceM"], places=6)
        self.assertAlmostEqual(est.duration_s, e["durationS"], places=6)

    def test_drive_matches_fixture(self):
        route, fixes = scripted_drive()
        self.assertEqual(run_drive(route, fixes), self.fx["drive"]["expected"])

    def test_drive_behaviour(self):
        expected = self.fx["drive"]["expected"]
        self.assertTrue(any(s["offRoute"] for s in expected), "GPS detour must trip off-route")
        self.assertEqual(sum(s["shouldReroute"] for s in expected), 1, "reroute is throttled to one request")
        self.assertTrue(expected[-1]["arrived"], "dwell near the door must count as arrival")
        self.assertEqual(expected[-1]["etaS"], 0)
        etas = [s["etaS"] for s in expected if not s["arrived"] and not s["offRoute"]]
        jumps = [b - a for a, b in zip(etas, etas[1:])]
        self.assertLess(max(jumps), 60, "smoothed ETA never jumps up by a minute between fixes")

    def test_destination_point_round_trip(self):
        p = destination_point(HAUPTMARKT, 73, 1500)
        self.assertAlmostEqual(haversine_m(HAUPTMARKT, p), 1500, delta=0.5)
        self.assertAlmostEqual(bearing_deg(HAUPTMARKT, p), 73, delta=0.1)

    def test_app_calibration_is_loadable_and_sane(self):
        cal = EtaCalibration.load()
        self.assertTrue(1.0 <= cal.detour_factor <= 2.5)
        speeds = [b.speed_mps for b in cal.speed_bands]
        self.assertEqual(speeds, sorted(speeds))
        self.assertTrue(all(2 <= s <= 30 for s in speeds))


if __name__ == "__main__":
    if "--regen" in sys.argv:
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(json.dumps(build_fixture(), indent=1) + "\n", encoding="utf-8")
        print(f"Wrote {FIXTURE}")
        sys.exit(0)
    unittest.main(verbosity=1)
