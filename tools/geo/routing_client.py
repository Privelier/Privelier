"""Free road-routing client: FOSSGIS OSRM first, FOSSGIS Valhalla second.

Same servers and fallback order as src/shared/tracking/routing.ts. Both are
community-run and free under a fair-use policy (identify yourself, stay
around one request per second, no bulk scraping) -- so every call here is
rate limited and carries a descriptive User-Agent.

Override the endpoints with PRIVELIER_OSRM_URL / PRIVELIER_VALHALLA_URL
(e.g. a self-hosted OSRM docker container) without touching code.
"""

from __future__ import annotations

import json
import os
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from geo_core import LngLat, TripRoute, decode_polyline

OSRM_URL = os.environ.get("PRIVELIER_OSRM_URL", "https://routing.openstreetmap.de/routed-car")
VALHALLA_URL = os.environ.get("PRIVELIER_VALHALLA_URL", "https://valhalla1.openstreetmap.de")
USER_AGENT = "Privelier-tools/1.0 (trip calibration and QA; low volume)"
MIN_INTERVAL_S = 1.1

_lock = threading.Lock()
_last_call = 0.0
_ssl = ssl.create_default_context()


class RoutingError(RuntimeError):
    pass


def _polite_get(url: str, timeout: float = 20) -> dict:
    global _last_call
    with _lock:
        wait = MIN_INTERVAL_S - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=_ssl) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RoutingError(f"{url.split('?')[0]}: {exc}") from exc


def route_osrm(origin: LngLat, dest: LngLat) -> TripRoute:
    coords = f"{origin[0]:.6f},{origin[1]:.6f};{dest[0]:.6f},{dest[1]:.6f}"
    data = _polite_get(f"{OSRM_URL}/route/v1/driving/{coords}?overview=full&geometries=polyline6&steps=false")
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError(f"OSRM: {data.get('code')}")
    best = data["routes"][0]
    return TripRoute(decode_polyline(best["geometry"], 6), float(best["distance"]), float(best["duration"]), "osrm")


def route_valhalla(origin: LngLat, dest: LngLat) -> TripRoute:
    payload = {
        "locations": [{"lon": origin[0], "lat": origin[1]}, {"lon": dest[0], "lat": dest[1]}],
        "costing": "auto",
        "units": "kilometers",
    }
    data = _polite_get(f"{VALHALLA_URL}/route?json={urllib.parse.quote(json.dumps(payload))}")
    trip = data.get("trip")
    if not trip or not trip.get("legs"):
        raise RoutingError("Valhalla: no trip")
    summary = trip["summary"]
    return TripRoute(
        decode_polyline(trip["legs"][0]["shape"], 6),
        float(summary["length"]) * 1000,
        float(summary["time"]),
        "valhalla",
    )


def route(origin: LngLat, dest: LngLat) -> Optional[TripRoute]:
    """Best available road route, or None when both servers fail."""
    for engine in (route_osrm, route_valhalla):
        try:
            return engine(origin, dest)
        except RoutingError:
            continue
    return None
