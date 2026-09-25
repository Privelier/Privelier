# Barber Studio analytics design

## Direction

The Studio opens with an editorial performance card: a large monthly booked
value, a quiet eight-week sparkline, and a three-period completed-cut count.
Pending requests and the next accepted appointment remain close to the top as
useful actions. Rating, repeat clients, busiest weekday, and top services form
the supporting insight layer. The visual treatment uses the app's charcoal,
ivory, and brass palette, Playfair/serif headings, Inter/sans body text, thin
rules, and flat surfaces. No gradients or decorative sample data.

## Metric definitions

- **Umsatz aus Buchungen** is the sum of price snapshots for bookings whose
  stored status is `completed`, grouped by the booking date. It is not cash
  collected; Privelier does not process payments.
- **Completed cuts** use the same completed-status rule for this week, this
  month, and all time. The trend uses the current and previous seven calendar
  weeks (Monday start).
- **Open requests** counts bookings still in `pending`.
- **Next appointment** is the earliest future `accepted` booking. Only its date,
  time, counterpart display name, and service name are returned.
- **Rating and reviews** use the rows in `reviews`; without reviews the rating
  stays absent rather than displaying a zero-star average.
- **Returning clients** counts customers with at least two completed bookings.
- **Top services** and **busiest weekday** use completed bookings only.
- Acceptance and cancellation rates are omitted because `bookings.status`
  stores only the current final state and the database has no transition
  history from which those rates could be calculated honestly.

## Data and empty states

Migration 0034 exposes one `SECURITY DEFINER` RPC. It checks `auth.uid()` against
`public.users.role = 'barber'`, filters every booking aggregate to that id,
returns aggregate JSON plus one small appointment summary, and grants execute
only to `authenticated`. The phone never downloads all booking rows for these
dashboard calculations. It receives no booking location, email, phone, or
identity documents. The Requests tab remains the only booking mutation surface.

Zero bookings produce real zero counts and booked value, a quiet baseline chart
with a first-booking invitation, no appointment, no rating, and empty service
and weekday insights. RPC failure degrades only the analytics card and keeps
the setup and management sections available.

## Native dependencies

The trend uses the already-installed `react-native-svg`; no dependency or new
native build is required.
