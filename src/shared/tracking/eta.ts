/**
 * Trip engine: turns a stream of GPS fixes plus one road route into the
 * numbers both apps show — remaining distance, a stable ETA, progress, and
 * the off-route / arrival decisions. Pure and clock-injected, so it is fully
 * unit-tested and mirrored by tools/geo/geo_core.py.
 *
 * Why not just "remaining distance / current speed"? Speed collapses to 0 at
 * every red light, which makes the ETA explode and then crash. Instead the
 * engine starts from the router's own pace for the road ahead and learns a
 * single correction factor from how the actual drive compares with what the
 * router predicted for the distance already covered (traffic, a slow
 * driver, parking). The displayed value is then smoothed so it ticks down
 * calmly instead of jittering every few seconds.
 */
import { ETA_CALIBRATION, type EtaCalibration } from './etaCalibration.generated';
import { cumulativeDistances, haversineM, projectOntoRoute, type LngLat, type RouteProjection } from './geo';

export interface TripRoute {
  coordinates: LngLat[];
  distanceM: number;
  durationS: number;
  source: 'osrm' | 'valhalla' | 'estimate';
}

export interface GpsFix {
  position: LngLat;
  timestampMs: number;
  speedMps?: number | null;
  accuracyM?: number | null;
  heading?: number | null;
}

export interface TripSnapshot {
  projection: RouteProjection | null;
  remainingM: number;
  etaS: number;
  /** 0..1 share of the route already driven. */
  progress: number;
  offRoute: boolean;
  /** True when the caller should fetch a fresh route now (throttled). */
  shouldReroute: boolean;
  arrived: boolean;
  /** Learned multiplier on the router's pace (1 = exactly as predicted). */
  paceFactor: number;
}

/** Tunables, exported so tests and the Python mirror share one source. */
export const TRIP_TUNING = {
  offRouteMinM: 50,
  offRouteAccuracyMultiplier: 1.5,
  offRouteFixesNeeded: 3,
  maxUsableAccuracyM: 65,
  rerouteCooldownMs: 30_000,
  arriveRadiusM: 40,
  arriveDwellRadiusM: 100,
  arriveDwellMs: 45_000,
  arriveDwellMaxSpeedMps: 2,
  paceLearnMinCoveredM: 300,
  paceLearnMinElapsedS: 60,
  paceFactorMin: 0.75,
  paceFactorMax: 1.8,
  paceAlpha: 0.2,
  etaAlpha: 0.35,
  etaJumpResetS: 180,
  minEtaS: 30,
} as const;

/** Straight-line estimate used when no road router is reachable. */
export function estimateTrip(from: LngLat, to: LngLat, calibration: EtaCalibration = ETA_CALIBRATION): TripRoute {
  const straight = haversineM(from, to);
  const distanceM = straight * calibration.detourFactor;
  const band =
    calibration.speedBands.find((b) => distanceM <= b.maxDistanceM) ??
    calibration.speedBands[calibration.speedBands.length - 1];
  const durationS = distanceM / band.speedMps + calibration.fixedOverheadS;
  return { coordinates: [from, to], distanceM, durationS, source: 'estimate' };
}

export class TripEngine {
  private route: TripRoute;
  private cumulative: number[];
  private readonly destination: LngLat;
  private readonly now: () => number;

  private startAlongM: number | null = null;
  private startMs: number | null = null;
  private paceFactor = 1;
  private smoothedEtaS: number | null = null;
  private offRouteStreak = 0;
  private lastRerouteMs = -Infinity;
  private dwellStartMs: number | null = null;
  private arrived = false;

  constructor(route: TripRoute, destination: LngLat, now: () => number = Date.now) {
    this.route = route;
    this.cumulative = cumulativeDistances(route.coordinates);
    this.destination = destination;
    this.now = now;
  }

  /** Swap in a fresh route (after a reroute). Keeps the learned pace. */
  setRoute(route: TripRoute): void {
    this.route = route;
    this.cumulative = cumulativeDistances(route.coordinates);
    this.startAlongM = null;
    this.startMs = null;
    this.offRouteStreak = 0;
    this.smoothedEtaS = null;
  }

  markRerouteRequested(): void {
    this.lastRerouteMs = this.now();
  }

  get currentRoute(): TripRoute {
    return this.route;
  }

  update(fix: GpsFix): TripSnapshot {
    const t = TRIP_TUNING;
    const nowMs = fix.timestampMs;
    const accuracy = fix.accuracyM ?? 0;
    const usable = accuracy <= t.maxUsableAccuracyM;
    const projection = projectOntoRoute(fix.position, this.route.coordinates, this.cumulative);
    const routeLength = this.cumulative[this.cumulative.length - 1] ?? 0;
    const toDestination = haversineM(fix.position, this.destination);

    // --- Off-route detection (needs consecutive, reasonably accurate fixes).
    const threshold = Math.max(t.offRouteMinM, accuracy * t.offRouteAccuracyMultiplier);
    if (projection && usable && this.route.source !== 'estimate') {
      this.offRouteStreak = projection.crossTrackM > threshold ? this.offRouteStreak + 1 : 0;
    }
    const offRoute = this.offRouteStreak >= t.offRouteFixesNeeded;
    const shouldReroute = offRoute && this.now() - this.lastRerouteMs >= t.rerouteCooldownMs;

    // --- Remaining distance: along the road when on it, else road + gap.
    let remainingM: number;
    if (!projection || this.route.source === 'estimate') {
      remainingM = toDestination * (this.route.source === 'estimate' ? ETA_CALIBRATION.detourFactor : 1);
    } else {
      remainingM = Math.max(0, routeLength - projection.alongM) + (offRoute ? projection.crossTrackM : 0);
    }
    // The straight line is a hard lower bound on any road distance.
    remainingM = Math.max(remainingM, toDestination);

    // --- Learn the pace factor from progress actually made.
    const pace = this.route.distanceM > 0 ? this.route.durationS / this.route.distanceM : 0.12;
    if (projection && usable && !offRoute) {
      if (this.startAlongM === null || this.startMs === null) {
        this.startAlongM = projection.alongM;
        this.startMs = nowMs;
      } else {
        const coveredM = projection.alongM - this.startAlongM;
        const elapsedS = (nowMs - this.startMs) / 1000;
        if (coveredM >= t.paceLearnMinCoveredM && elapsedS >= t.paceLearnMinElapsedS) {
          const raw = Math.min(t.paceFactorMax, Math.max(t.paceFactorMin, elapsedS / (coveredM * pace)));
          this.paceFactor += t.paceAlpha * (raw - this.paceFactor);
        }
      }
    }

    // --- Arrival: close enough, or lingering nearby at walking pace.
    if (!this.arrived) {
      if (toDestination <= t.arriveRadiusM) {
        this.arrived = true;
      } else if (toDestination <= t.arriveDwellRadiusM && (fix.speedMps ?? 0) <= t.arriveDwellMaxSpeedMps) {
        this.dwellStartMs ??= nowMs;
        if (nowMs - this.dwellStartMs >= t.arriveDwellMs) this.arrived = true;
      } else {
        this.dwellStartMs = null;
      }
    }

    // --- ETA, smoothed.
    let etaS = remainingM * pace * this.paceFactor;
    if (this.arrived) {
      etaS = 0;
      this.smoothedEtaS = 0;
    } else {
      etaS = Math.max(t.minEtaS, etaS);
      if (this.smoothedEtaS === null || Math.abs(etaS - this.smoothedEtaS) >= t.etaJumpResetS) {
        this.smoothedEtaS = etaS;
      } else {
        this.smoothedEtaS += t.etaAlpha * (etaS - this.smoothedEtaS);
      }
      etaS = Math.max(t.minEtaS, this.smoothedEtaS);
    }

    const progress = this.route.distanceM > 0 ? Math.min(1, Math.max(0, 1 - remainingM / Math.max(this.route.distanceM, remainingM))) : 0;

    return {
      projection,
      remainingM: this.arrived ? 0 : remainingM,
      etaS: Math.round(etaS),
      progress: this.arrived ? 1 : progress,
      offRoute,
      shouldReroute,
      arrived: this.arrived,
      paceFactor: this.paceFactor,
    };
  }
}

/** "4 min", "1 h 05 min" — rounded up so "0 min" never shows before arrival. */
export function formatEta(etaS: number, de: boolean): string {
  if (etaS <= 0) return de ? 'Jetzt' : 'Now';
  const minutes = Math.max(1, Math.ceil(etaS / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  return `${h} h ${m} min`;
}

export function formatDistance(meters: number, de: boolean): string {
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  const text = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${de ? text.replace('.', ',') : text} km`;
}
