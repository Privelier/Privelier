/**
 * Explore tab pure logic (Run B — design: docs/design/explore-location-
 * design-approval.md, conditions C8/C9). No network in this module: the
 * screen composes the EXISTING reads (fetchOwnProfile → listBarbersByCity →
 * listServicesForBarberIds + listAvailabilityForBarberIds) and everything
 * here derives from already-fetched rows, so it unit-tests without mocks.
 *
 * Honesty rules made code:
 *  - toMapPin returns null when either display coordinate is missing — a
 *    barber without location data can NEVER produce a pin (founder decision
 *    D4). The coordinates used are ONLY the offset display pair the
 *    barber_directory view republishes; exact coordinates never reach the
 *    customer app at all (0019's RLS makes that structural, not a habit).
 *  - Filters only ever NARROW the RLS-authorized directory list — no filter
 *    can widen access (no client-side authz, condition C8).
 */
import type { AvailabilityRow, BarberDirectoryRow, ServiceRow } from '../types';

export type ExploreFilterKey = 'all' | 'today' | 'under100' | 'verified';

/** "Under €100" chip threshold (founder-specified label; strict less-than). */
export const UNDER_PRICE_THRESHOLD = 100;

/**
 * Map view availability. The current dev client does NOT contain the
 * @rnmapbox/maps native module, and the package cannot even be installed
 * until the founder creates the Mapbox secret download token (an installed-
 * but-tokenless package fails every EAS build at the Gradle SDK-download
 * step). Until that lands, the Explore map/list toggle renders an honest
 * "arrives with the next app update" state for the map — never a crash,
 * never a fake map. Flip this to real native-module feature detection in the
 * map-integration follow-up (tracked in CLAUDE.md).
 */
export const MAP_VIEW_AVAILABLE = false;

/** Cheapest service price, or null when no services are known. */
export function fromPrice(services: ServiceRow[]): number | null {
  let min: number | null = null;
  for (const s of services) {
    if (typeof s.price !== 'number' || !Number.isFinite(s.price)) continue;
    if (min === null || s.price < min) min = s.price;
  }
  return min;
}

/** Local calendar date of `now` as the DB's YYYY-MM-DD shape — built from
 * local components, never `toISOString()` (UTC would roll the date across
 * midnight for non-UTC users; same rule as src/shared/slots.ts). */
function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * "Available today" = the barber has working hours covering today, following
 * slots.ts's window-selection rule: specific_date rows for today's date take
 * full precedence; otherwise a recurring day_of_week row for today's weekday
 * counts. DELIBERATE approximation (documented for the founders): this does
 * not check remaining free time-of-day slots — that would need the busy-slot
 * RPC per barber per day, far too heavy for a list filter. "Has working
 * hours today", not "has a free slot right now".
 */
export function windowCoversToday(windows: AvailabilityRow[], now: Date): boolean {
  if (windows.length === 0) return false;
  const today = localDateString(now);
  if (windows.some((w) => w.specific_date === today)) return true;
  const weekday = now.getDay();
  return windows.some((w) => w.specific_date === null && w.day_of_week === weekday);
}

export interface ExploreFilterContext {
  servicesByBarber: Map<string, ServiceRow[]>;
  windowsByBarber: Map<string, AvailabilityRow[]>;
  now: Date;
}

/**
 * Apply one active chip to the directory list. Pure narrowing — see header.
 * 'verified' filters on the view's verified flag; note the recorded flag:
 * every directory row is approved ⇒ verified by construction today, so this
 * chip currently selects everything (founder-acknowledged).
 */
export function applyExploreFilter(
  barbers: BarberDirectoryRow[],
  filter: ExploreFilterKey,
  ctx: ExploreFilterContext
): BarberDirectoryRow[] {
  switch (filter) {
    case 'all':
      return barbers;
    case 'today':
      return barbers.filter((b) => windowCoversToday(ctx.windowsByBarber.get(b.id) ?? [], ctx.now));
    case 'under100':
      return barbers.filter((b) => {
        const min = fromPrice(ctx.servicesByBarber.get(b.id) ?? []);
        return min !== null && min < UNDER_PRICE_THRESHOLD;
      });
    case 'verified':
      return barbers.filter((b) => b.verified === true);
  }
}

/** A renderable price-pin: id + the OFFSET coordinates + the real from-price
 * (null when no priced services are known — the pin then renders without a
 * price label rather than inventing one). */
export interface ExploreMapPin {
  barberId: string;
  latitude: number;
  longitude: number;
  fromPrice: number | null;
}

/**
 * The honesty rule as code (D4): no display coordinates ⇒ no pin, ever.
 * Returns null rather than a default/fake position.
 */
export function toMapPin(
  barber: BarberDirectoryRow,
  services: ServiceRow[]
): ExploreMapPin | null {
  const { display_latitude, display_longitude } = barber;
  if (
    typeof display_latitude !== 'number' ||
    typeof display_longitude !== 'number' ||
    !Number.isFinite(display_latitude) ||
    !Number.isFinite(display_longitude)
  ) {
    return null;
  }
  return {
    barberId: barber.id,
    latitude: display_latitude,
    longitude: display_longitude,
    fromPrice: fromPrice(services),
  };
}
