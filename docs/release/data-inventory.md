# Data inventory

Source for the App Store App Privacy labels and the Google Play Data safety form. Everything is stored in one Supabase project in the EU (eu-central-1, Frankfurt); nothing is sold, used for advertising or shared with data brokers, and there are no analytics or advertising SDKs.

| Data | Who | Purpose | Where | Retention | Third parties |
|---|---|---|---|---|---|
| Name, email | All users | Account, sign-in, showing the barber's name to customers, the customer's name to their own barber, and a reviewer's first name on reviews | `auth.users`, `public.users` | Until account deletion | Supabase (processor); the email provider that sends auth emails |
| Phone (optional) | All users | Contact for an appointment | `public.users` | Until account deletion | Supabase |
| City and country | All users | Discovery by city | `public.users` | Until account deletion | Supabase |
| Time zone | Barbers (default for everyone) | Checking that a requested appointment is in the future in the barber's local time | `public.users.time_zone`, from the device setting | Until account deletion | Supabase |
| Appointment address | Customers | Where the barber travels | `public.bookings.location` | Kept with the booking; anonymized (customer id removed) on deletion, visible only to that booking's barber | Supabase; Photon (address search, the typed text only) |
| Saved addresses | Customers | Faster booking | `public.customer_addresses` | Until the customer removes them or deletes the account | Supabase |
| Barber base location | Barbers | Approximate map position (offset 200-500 m) | `public.barber_location` (exact point private to the barber) | Until account deletion | Supabase; OpenFreeMap tiles (map display, no user data) |
| Live location during a trip | Barbers | Arrival time for the customer | `public.booking_trips` | Cleared when the trip ends; the row is deleted with the account | Supabase; FOSSGIS OSRM/Valhalla (route between two points) |
| Photos (portfolio) | Barbers | Public portfolio | Storage bucket `portfolio` (public by URL, not listable) | Until removed or account deletion | Supabase |
| ID and licence photos | Barbers | Manual verification by the founders | Storage bucket `verification-docs` (private) | Until account deletion | Supabase |
| Messages | Both | Coordinating a booking | `public.messages` | Kept for the other participant; sender anonymized on deletion | Supabase |
| Reviews | Customers | Ratings for barbers | `public.reviews` | Rating kept, comment erased and author removed on deletion | Supabase |
| Reports and blocks | Both | Safety and moderation | `public.user_reports`, `public.user_blocks` | Reports kept for moderation with ids removed on deletion; blocks deleted with the account | Supabase |
| Safety events (SOS) | Both | Emergency record for the founders | `public.safety_events` | Kept for safety review; person removed on deletion | Supabase |
| Push token | Both | Booking and message notifications | `public.push_tokens` | Removed on sign-out and account deletion | Expo push service, Apple APNs, Google FCM |
| Consent record | All users | Proof of accepted terms and age | `public.legal_consent_history` | Deleted with the account | Supabase |
| Crash or diagnostic data | None | Not collected | | | |

## App Privacy label summary

- Contact info (name, email, phone): linked to the user, used for app functionality.
- Location (precise during trips for barbers; address for customers): linked, app functionality.
- User content (photos, messages, reviews): linked, app functionality.
- Identifiers (user id, push token): linked, app functionality.
- Not used for tracking.
