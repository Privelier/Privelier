# Glossary

The domain terms the code uses, taken from the database. Use these names in code, copy and docs; the table or column in brackets is the source of truth.

| Term | Meaning |
|---|---|
| Customer | A user who books barbers (`users.role = 'customer'`). |
| Barber | A user who offers services at the customer's location (`users.role = 'barber'`, with a `barber_profile`). |
| Admin | One of the two founders, working in the Supabase dashboard (`users.role = 'admin'`). There is no admin app. |
| Verification | The manual review of a barber's ID and licence photos (`verification_requests`, private bucket `verification-docs`). Only an approved barber (`barber_profile.verification_status = 'approved'`) appears to customers. |
| Service | Something a barber offers, with a price and a duration (`services`). |
| Availability | A barber's working window, weekly (`day_of_week`) or for one date (`specific_date`) (`availability`). A day off blocks a date (`barber_days_off`). |
| Booking | One appointment request from a customer for a barber's service at a time and address (`bookings`). Its price and duration are snapshots taken from the service when it is created. Never "appointment", "reservation" or "order" in code; the one legacy exception is the `next_appointment` field of the `get_barber_dashboard_analytics` RPC (migration 0034), mirrored as `nextAppointment`. User-facing copy may say "appointment". |
| Booking status | `pending`, `accepted`, `rejected`, `completed` or `cancelled`, moving only as `AGENTS.md` describes. |
| Slot | The half-open time range `[start, end)` a booking occupies (`bookings.slot`); two active slots for one barber may not overlap. |
| Chat room | The one conversation attached to a booking (`chat_rooms`), created by the database. |
| Message | One text in a chat room, 1 to 2000 characters (`messages`). |
| Review | A customer's 1 to 5 star rating, with an optional comment, of one completed booking (`reviews`). |
| Portfolio | A barber's public photos, at most six (`portfolio`, public bucket `portfolio`). |
| Directory | The approved barbers a customer can discover (`barber_directory` view over `barber_public_profile`). |
| Display location | The barber's public map point, offset 200 to 500 m from the real one (`barber_location.display_latitude/longitude`). The real point is private. |
| Trip | A barber's live journey to an accepted booking (`booking_trips`). |
| Report | A user's report of another user, a message or a review (`user_reports`). |
| Block | One user hiding from another: no new messages or bookings between them, and the barber leaves the customer's directory (`user_blocks`). |
| Deleted participant | The other person on a booking, chat or review after they deleted their account; their id is null and the apps show a former customer or barber. |
