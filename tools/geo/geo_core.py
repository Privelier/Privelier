"""Reference implementation of Privelier's trip geo math and ETA engine.

This mirrors src/shared/tracking/geo.ts and src/shared/tracking/eta.ts
line for line. Both implementations are checked against the same vectors in
fixtures/geo_vectors.json (Python: test_geo_core.py, TypeScript:
src/shared/tracking/__tests__/geo.test.ts), so the tooling that calibrates
and simulates trips can never drift from what the apps actually compute.

Standard library only. Coordinates are (longitude, latitude) tuples.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Sequence

LngLat = tuple[float, float]

EARTH_RADIUS_M = 6_371_008.8

# Mirrors TRIP_TUNING in eta.ts.
TRIP_TUNING = {
    "offRouteMinM": 50,
    "offRouteAccuracyMultiplier": 1.5,
    "offRouteFixesNeeded": 3,
    "maxUsableAccuracyM": 65,
    "rerouteCooldownMs": 30_000,
    "arriveRadiusM": 40,
    "arriveDwellRadiusM": 100,
    "arriveDwellMs": 45_000,
    "arriveDwellMaxSpeedMps": 2,
    "paceLearnMinCoveredM": 300,
    "paceLearnMinElapsedS": 60,
    "paceFactorMin": 0.75,
    "paceFactorMax": 1.8,
    "paceAlpha": 0.2,
    "etaAlpha": 0.35,
    "etaJumpResetS": 180,
    "minEtaS": 30,
}

CALIBRATION_TS = (
    Path(__file__).resolve().parents[2] / "src" / "shared" / "tracking" / "etaCalibration.generated.ts"
)


# ---------------------------------------------------------------------------
# Distances and bearings
# ---------------------------------------------------------------------------

def haversine_m(a: LngLat, b: LngLat) -> float:
    d_lat = math.radians(b[1] - a[1])
    d_lng = math.radians(b[0] - a[0])
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a[1])) * math.cos(math.radians(b[1])) * math.sin(d_lng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def bearing_deg(a: LngLat, b: LngLat) -> float:
    phi1, phi2 = math.radians(a[1]), math.radians(b[1])
    d_lambda = math.radians(b[0] - a[0])
    y = math.sin(d_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lambda)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def cumulative_distances(route: Sequence[LngLat]) -> list[float]:
    out = [0.0]
    for i in range(1, len(route)):
        out.append(out[-1] + haversine_m(route[i - 1], route[i]))
    return out


def line_length_m(line: Sequence[LngLat]) -> float:
    return cumulative_distances(line)[-1] if line else 0.0


def destination_point(origin: LngLat, bearing: float, distance_m: float) -> LngLat:
    """Point reached from origin after distance_m on a great circle."""
    delta = distance_m / EARTH_RADIUS_M
    theta = math.radians(bearing)
    phi1, lam1 = math.radians(origin[1]), math.radians(origin[0])
    phi2 = math.asin(math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta))
    lam2 = lam1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )
    return ((math.degrees(lam2) + 540) % 360 - 180, math.degrees(phi2))


# ---------------------------------------------------------------------------
# Encoded polylines
# ---------------------------------------------------------------------------

def decode_polyline(encoded: str, precision: int = 6) -> list[LngLat]:
    factor = 10 ** precision
    out: list[LngLat] = []
    index = lat = lng = 0
    length = len(encoded)
    while index < length:
        deltas = []
        for _ in range(2):
            result = shift = 0
            while True:
                if index >= length:
                    return out
                byte = ord(encoded[index]) - 63
                index += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lng += deltas[1]
        out.append((lng / factor, lat / factor))
    return out


def encode_polyline(line: Sequence[LngLat], precision: int = 6) -> str:
    factor = 10 ** precision
    out: list[str] = []
    prev_lat = prev_lng = 0

    def encode_value(value: int) -> None:
        v = ~(value << 1) if value < 0 else value << 1
        while v >= 0x20:
            out.append(chr((0x20 | (v & 0x1F)) + 63))
            v >>= 5
        out.append(chr(v + 63))

    for lng, lat in line:
        i_lat = _js_round(lat * factor)
        i_lng = _js_round(lng * factor)
        encode_value(i_lat - prev_lat)
        encode_value(i_lng - prev_lng)
        prev_lat, prev_lng = i_lat, i_lng
    return "".join(out)


def _js_round(x: float) -> int:
    """Math.round semantics (half rounds toward +infinity), not banker's rounding."""
    return math.floor(x + 0.5)


# ---------------------------------------------------------------------------
# Route projection
# ---------------------------------------------------------------------------

@dataclass
class RouteProjection:
    point: LngLat
    segment_index: int
    along_m: float
    cross_track_m: float


def project_onto_route(
    fix: LngLat, route: Sequence[LngLat], cumulative: Optional[Sequence[float]] = None
) -> Optional[RouteProjection]:
    if not route:
        return None
    if len(route) == 1:
        return RouteProjection(route[0], 0, 0.0, haversine_m(fix, route[0]))
    cumulative = cumulative if cumulative is not None else cumulative_distances(route)
    cos_lat = math.cos(math.radians(fix[1]))
    best: Optional[RouteProjection] = None
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        ax = math.radians(a[0] - fix[0]) * cos_lat * EARTH_RADIUS_M
        ay = math.radians(a[1] - fix[1]) * EARTH_RADIUS_M
        bx = math.radians(b[0] - fix[0]) * cos_lat * EARTH_RADIUS_M
        by = math.radians(b[1] - fix[1]) * EARTH_RADIUS_M
        dx, dy = bx - ax, by - ay
        len2 = dx * dx + dy * dy
        t = 0.0 if len2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / len2))
        px, py = ax + t * dx, ay + t * dy
        cross = math.hypot(px, py)
        if best is None or cross < best.cross_track_m:
            seg_len = cumulative[i + 1] - cumulative[i]
            best = RouteProjection(
                (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])),
                i,
                cumulative[i] + t * seg_len,
                cross,
            )
    return best


# ---------------------------------------------------------------------------
# Calibration + ETA engine
# ---------------------------------------------------------------------------

@dataclass
class SpeedBand:
    max_distance_m: float
    speed_mps: float


@dataclass
class EtaCalibration:
    detour_factor: float
    speed_bands: list[SpeedBand]
    fixed_overhead_s: float

    @staticmethod
    def load(path: Path = CALIBRATION_TS) -> "EtaCalibration":
        """Reads the JSON payload embedded in the generated TypeScript file."""
        text = path.read_text(encoding="utf-8")
        start = text.index("/*JSON*/") + len("/*JSON*/")
        end = text.index("/*END*/")
        data = json.loads(text[start:end])
        return EtaCalibration(
            detour_factor=data["detourFactor"],
            speed_bands=[SpeedBand(b["maxDistanceM"], b["speedMps"]) for b in data["speedBands"]],
            fixed_overhead_s=data["fixedOverheadS"],
        )


@dataclass
class TripRoute:
    coordinates: list[LngLat]
    distance_m: float
    duration_s: float
    source: str  # 'osrm' | 'valhalla' | 'estimate'


def estimate_trip(origin: LngLat, dest: LngLat, calibration: EtaCalibration) -> TripRoute:
    distance = haversine_m(origin, dest) * calibration.detour_factor
    band = next((b for b in calibration.speed_bands if distance <= b.max_distance_m), calibration.speed_bands[-1])
    duration = distance / band.speed_mps + calibration.fixed_overhead_s
    return TripRoute([origin, dest], distance, duration, "estimate")


@dataclass
class GpsFix:
    position: LngLat
    timestamp_ms: float
    speed_mps: Optional[float] = None
    accuracy_m: Optional[float] = None
    heading: Optional[float] = None


@dataclass
class TripSnapshot:
    remaining_m: float
    eta_s: int
    progress: float
    off_route: bool
    should_reroute: bool
    arrived: bool
    pace_factor: float
    projection: Optional[RouteProjection] = None


@dataclass
class TripEngine:
    route: TripRoute
    destination: LngLat
    calibration: EtaCalibration
    now_ms: callable = field(default=lambda: 0.0)

    def __post_init__(self) -> None:
        self._cumulative = cumulative_distances(self.route.coordinates)
        self._start_along: Optional[float] = None
        self._start_ms: Optional[float] = None
        self.pace_factor = 1.0
        self._smoothed_eta: Optional[float] = None
        self._off_route_streak = 0
        self._last_reroute_ms = -math.inf
        self._dwell_start_ms: Optional[float] = None
        self.arrived = False

    def set_route(self, route: TripRoute) -> None:
        self.route = route
        self._cumulative = cumulative_distances(route.coordinates)
        self._start_along = None
        self._start_ms = None
        self._off_route_streak = 0
        self._smoothed_eta = None

    def mark_reroute_requested(self) -> None:
        self._last_reroute_ms = self.now_ms()

    def update(self, fix: GpsFix) -> TripSnapshot:
        t = TRIP_TUNING
        now = fix.timestamp_ms
        accuracy = fix.accuracy_m or 0.0
        usable = accuracy <= t["maxUsableAccuracyM"]
        projection = project_onto_route(fix.position, self.route.coordinates, self._cumulative)
        route_length = self._cumulative[-1] if self._cumulative else 0.0
        to_dest = haversine_m(fix.position, self.destination)

        threshold = max(t["offRouteMinM"], accuracy * t["offRouteAccuracyMultiplier"])
        if projection and usable and self.route.source != "estimate":
            self._off_route_streak = self._off_route_streak + 1 if projection.cross_track_m > threshold else 0
        off_route = self._off_route_streak >= t["offRouteFixesNeeded"]
        should_reroute = off_route and self.now_ms() - self._last_reroute_ms >= t["rerouteCooldownMs"]

        if projection is None or self.route.source == "estimate":
            remaining = to_dest * (self.calibration.detour_factor if self.route.source == "estimate" else 1)
        else:
            remaining = max(0.0, route_length - projection.along_m) + (projection.cross_track_m if off_route else 0)
        remaining = max(remaining, to_dest)

        pace = self.route.duration_s / self.route.distance_m if self.route.distance_m > 0 else 0.12
        if projection and usable and not off_route:
            if self._start_along is None or self._start_ms is None:
                self._start_along, self._start_ms = projection.along_m, now
            else:
                covered = projection.along_m - self._start_along
                elapsed = (now - self._start_ms) / 1000
                if covered >= t["paceLearnMinCoveredM"] and elapsed >= t["paceLearnMinElapsedS"]:
                    raw = min(t["paceFactorMax"], max(t["paceFactorMin"], elapsed / (covered * pace)))
                    self.pace_factor += t["paceAlpha"] * (raw - self.pace_factor)

        if not self.arrived:
            if to_dest <= t["arriveRadiusM"]:
                self.arrived = True
            elif to_dest <= t["arriveDwellRadiusM"] and (fix.speed_mps or 0) <= t["arriveDwellMaxSpeedMps"]:
                if self._dwell_start_ms is None:
                    self._dwell_start_ms = now
                if now - self._dwell_start_ms >= t["arriveDwellMs"]:
                    self.arrived = True
            else:
                self._dwell_start_ms = None

        eta = remaining * pace * self.pace_factor
        if self.arrived:
            eta = 0.0
            self._smoothed_eta = 0.0
        else:
            eta = max(t["minEtaS"], eta)
            if self._smoothed_eta is None or abs(eta - self._smoothed_eta) >= t["etaJumpResetS"]:
                self._smoothed_eta = eta
            else:
                self._smoothed_eta += t["etaAlpha"] * (eta - self._smoothed_eta)
            eta = max(t["minEtaS"], self._smoothed_eta)

        if self.route.distance_m > 0:
            progress = min(1.0, max(0.0, 1 - remaining / max(self.route.distance_m, remaining)))
        else:
            progress = 0.0

        return TripSnapshot(
            remaining_m=0.0 if self.arrived else remaining,
            eta_s=_js_round(eta),
            progress=1.0 if self.arrived else progress,
            off_route=off_route,
            should_reroute=should_reroute,
            arrived=self.arrived,
            pace_factor=self.pace_factor,
            projection=projection,
        )
