/**
 * Small display-formatting helpers shared by the customer and barber UIs.
 * Pure functions, no I/O — unit-tested via customer/__tests__/format.test.ts.
 */

/**
 * Sentence-case display labels for the booking_status enum — shared by the
 * customer Bookings tab and the barber Requests tab.
 */
export const BOOKING_STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

/** "Good morning" / "Good afternoon" / "Good evening" by local hour. */
export function timeOfDayGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** First word of a full name, or a calm fallback when nothing is set. */
export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] || 'there';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * "Wed 8 Jul · 14:30" from a bookings row's DATE (YYYY-MM-DD) and TIME
 * (HH:MM:SS) strings. Deterministic English short forms (no device-locale
 * dependence); falls back to the raw strings if the date fails to parse.
 */
export function formatBookingWhen(date: string, time: string): string {
  const clock = time.slice(0, 5);
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return `${date} · ${clock}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · ${clock}`;
}

/**
 * "8 Jul" from an ISO timestamp or YYYY-MM-DD date string — the compact
 * right-aligned time on inbox rows. Same deterministic short forms as
 * formatBookingWhen; empty string if unparseable.
 */
export function formatShortDate(iso: string): string {
  // A bare YYYY-MM-DD parses as UTC midnight, which getDate() would shift
  // in negative-offset timezones — anchor it to local midnight instead.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Price display. Whole-euro amounts render without decimals ("€110");
 * fractional amounts keep their cents exactly ("€42.50") — never rounded,
 * since real service prices appear on the profile detail page.
 * (Single-market MVP: currency is fixed to EUR; multi-currency is
 * explicitly out of scope per CLAUDE.md.)
 */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? `€${amount}` : `€${amount.toFixed(2)}`;
}
