# Privelier WOW Pass: Master Plan

Owner: Taha (founder). Date: 2026-09-25. Executor: Codex.

## Mission

Privelier works. Every core flow exists. It does not yet feel premium. Take the whole
app experience from "functional" to "wow" without changing the identity: same
charcoal/ivory/brass palette, Playfair Display + Inter, calm members-club tone.
This is a craft pass: motion, feedback, flow, detail, system integration and
small moments of delight. Think like the design and engineering teams behind the
best hospitality and booking apps. Every tap should feel intentional, every
wait should feel short, every screen should answer "what now?".

You own the design decisions inside this plan. Be bold in craft, restrained in
style. When in doubt: fewer elements, better executed.

## Non-negotiables

- Identity stays: tokens from the existing theme, Playfair headings, Inter body,
  brass as a restrained accent, no gradients, no neon, no bouncy toy motion.
- Never show fake, sample or estimated data. Empty and low-data states must look
  intentional and beautiful.
- Booking state machine is untouched. No new booking states. Payments stay off.
- Schema changes only via proper migration + RLS + security check. The Supabase
  MCP is read-only: print migration SQL (including the
  supabase_migrations.schema_migrations insert) for Taha to run in the SQL
  Editor, wait for confirmation, then verify read-only before pushing dependent
  code.
- Collect ALL new native dependencies into one batch (see Wave 1), install them
  together, and start one development build per platform (iOS + Android) once.
  Do not add native deps piecemeal.
- One commit per item with a real descriptive message. Push after each wave.
  git pull before starting each wave (Ali works in parallel).
- Typecheck, lint and full test suite green after every item. Update unit tests
  and Maestro flows for every changed flow. Keep existing testIDs.
- Respect accessibility: every interactive element has an accessibilityLabel,
  44pt minimum hit targets, dynamic type does not break layouts, all motion
  respects the OS "Reduce Motion" setting (fall back to simple fades).
- Record design decisions in docs/design/wow-pass.md as you go, including
  before/after screenshots per screen where you can capture them.

## Founder decisions (Taha, 2026-09-25)

1. App language: German + English, following the device language. German is the
   primary market. English is the fallback for all other locales.
2. Appointment reminders: LOCAL scheduled notifications only (scheduled on the
   device, no server push). Server push remains out of scope.
3. "Barber is on the way" is communicated via an automatic chat message sent by
   the barber from a one-tap action, not a new booking state.

## Issues observed on device (fix all of these)

- Status labels ("Cancelled", "Completed", "Accepted", "Pending") are wide
  letter-spaced plain text. Replace with semantic status pills (subtle filled
  capsule, success/brass/muted/error tones from the theme).
- Barber Requests list mixes history and actionable items and puts cancelled and
  completed items above an accepted upcoming one. Restructure into sections:
  "Needs action" (pending), "Today", "Upcoming", "History" (collapsed by
  default). Actionable first, always.
- Price figures render in a different serif style on the review screen
  ("€30" with old-style numerals). Use one consistent numeral style for all
  prices and stats (tabular lining figures), everywhere.
- Destructive "Cancel booking" is a large red outline button on every card.
  Move destructive actions into the booking detail screen or a swipe action,
  keep cards calm and tappable.
- Booking cards are not tappable. Every booking card opens a booking detail
  screen (see Wave 2).
- Chat header shows two single letters ("T" / "T"). Show avatar, name, service
  and appointment date. Chat has no booking context, no date separators and a
  timestamp inside every bubble.
- Avatars are a single serif letter in a dark square. Replace with a refined
  monogram avatar: initials, deterministic warm tint per user, thin brass
  hairline ring. Real photos when available with a blurred placeholder.
- Barber profile hero without photo is a giant "T" on a grey block. Design an
  intentional no-photo hero (monogram, texture from the brand, name, city,
  rating) that still looks premium.
- Verification screen shows "Approved" while both document rows say
  "Not uploaded" with Upload buttons. Once approved: show "Verified since
  <date>" and collapse the document section.
- Address step shows an error before the user has typed. Validate on blur or on
  submit, not on first render. Placeholder text is English ("12 Example
  Street") and will be localized.
- Booking success screen is minimal. See Wave 2 for the new version.
- Barber location card: tapping the location anywhere it is shown must open the
  location editor directly.
- The floating blue gear button is the Expo dev-client tools button and does not
  exist in production builds. Ignore it, but make sure no layout (like the step
  indicator in the booking flow) depends on that corner being empty.

## Wave 0: Audit and plan (short, then proceed)

1. Walk every screen in both apps (from code and, where possible, on device).
   Produce docs/design/wow-pass.md with a table: screen, current problems,
   planned improvements, wave. Add anything this plan missed.
2. List every new dependency you intend to add, marked native or JS-only, with
   the reason. Then proceed without waiting.

## Wave 1: Foundation (design system level, benefits every screen)

Build these as reusable primitives first, then apply everywhere.

- Motion system: central motion tokens (durations, easing curves, spring
  presets) using react-native-reanimated (already installed). Standard patterns:
  screen enter, list item stagger (subtle, fast, only on first load), press
  scale feedback (0.97) on all tappable cards and buttons, number count-up for
  dashboard stats, checkmark draw animation, sheet slide, tab indicator slide.
  All disabled or simplified under Reduce Motion.
- Haptics (expo-haptics): light on selection (date, time slot, chips, tabs),
  medium on primary confirm, success on booking request/accept, warning on
  destructive confirm. Central helper, never scattered raw calls.
- Skeleton loaders: brand-toned shimmer placeholders matching the final layout
  for every list and detail screen. No spinners on first load, no empty-state
  flash before data arrives.
- Status pill component (see issues).
- Monogram avatar component (see issues) + image component with blurred
  placeholder and caching (expo-image).
- Bottom sheet component for confirmations, pickers and quick actions instead
  of native alerts (gesture-driven, backdrop, keyboard-aware). Use
  @gorhom/bottom-sheet if its dependencies are already satisfied, otherwise
  build on reanimated + gesture-handler.
- Toast/snackbar component for non-blocking feedback ("Adresse gespeichert"),
  with an optional action.
- Cancel with undo: when a user cancels a booking, show a 5-second undo toast
  and only send the cancellation after the window closes. The state machine is
  unchanged: the request is simply delayed.
- Typography pass: consistent heading scale, tabular lining numerals for all
  money, times and stats, sentence case, no stray em dashes in UI copy.
- Empty states: each with a small line-art SVG illustration in brand style
  (react-native-svg), one sentence, one clear action.
- Pull to refresh with a brand-toned indicator on every list.
- Offline awareness (@react-native-community/netinfo): a calm banner when
  offline, cached content stays visible, actions queue or explain clearly.
- Perceived speed: stale-while-revalidate caching for lists and profiles so
  revisiting a screen is instant. Prefetch the barber profile when a barber
  card is pressed in. Consider @tanstack/react-query if it simplifies this.
- Tab bars: animated active indicator, unread badge counts, haptic on switch.
- Keyboard: smooth avoidance everywhere, "next" moves between fields, tap
  outside dismisses, submit on last field.
- Forms: validate on blur/submit, inline friendly errors, correct keyboard types
  (email, phone, numeric, postal code), autofill hints (email, name, address,
  password, one-time code).

Native dependency batch (install together, then one dev build per platform):
expo-haptics, expo-calendar, expo-image, expo-notifications,
expo-localization, @react-native-community/netinfo, expo-clipboard, plus
anything else from Waves 2 to 7 that requires native code. Decide the final
list in Wave 0. After installing: update app config permissions and usage
strings (calendar, notifications) in both German and English, start the EAS
development builds, and tell Taha the build links.

## Wave 2: Customer journey

Discover
- Personal greeting with first name and time of day (exists: refine type and
  motion).
- Barber cards show "Nächster freier Termin: heute 16:30" computed from real
  availability and busy slots (server-side RPC, one call for the visible list,
  not N calls). If none within 14 days, omit it.
- Favorite barbers: heart on card and profile with a satisfying fill animation
  and haptic, "Favoriten" filter. Requires a small favorites table with
  own-row RLS.
- Search with instant results, recent searches, clear button.

Barber profile
- Parallax hero, name and verified badge animate into the header on scroll.
- Sticky bottom bar: "Buchen ab €30" always reachable.
- Portfolio: fullscreen gallery with swipe and pinch-to-zoom.
- Reviews: real rating distribution bars, newest first.
- Share profile: native share sheet with a deep link
  (privelier://barber/<id>) and a short text.

Booking flow
- Animated progress indicator with step names.
- Date strip: each day shows an availability density dot (none, few, many)
  from real slot data; unavailable days muted, not hidden.
- Time slots grouped Vormittag / Nachmittag / Abend, selected slot animates,
  haptic on select. A "Nächster freier Termin" shortcut chip at the top.
- Address: autocomplete via Mapbox geocoding (token already configured, same
  approach as the barber location editor). Saved addresses ("Zuhause",
  "Büro", "Hotel", custom label) stored per user with own-row RLS, last used
  address prefilled. Optional access notes ("Klingel: Müller, 3. OG").
- Optional note to the barber ("Wie immer, Seiten etwas kürzer").
- Review screen: small static map preview of the address (Mapbox Static Images
  API, no native dependency), clear price breakdown, honest "Bezahlung direkt
  beim Barber" wording consistent with the current no-payments reality.
- Primary confirm with haptic and a brief pressed state.

Booking success (make this a moment)
- Animated checkmark draw with a restrained brass ring pulse.
- Summary card: barber, service, date, time, address.
- "Was passiert jetzt?" mini timeline: Angefragt (done) → Barber bestätigt →
  Termin → Bewerten.
- Actions: "Zum Kalender hinzufügen" (expo-calendar, event with title,
  address as location, notes, and a 60 min alert), "Barber schreiben",
  "Zu meinen Buchungen".

Booking detail screen (new, opened from every booking card, both apps)
- Status pill + live status timeline driven by realtime updates.
- Date, time, duration, service, price, address with map preview.
- Actions: add to calendar, message, open in Maps (customer: none; barber:
  route), share appointment, cancel (with reason chips and undo toast).
- For completed bookings: "Bewerten" and "Nochmal buchen" (same barber, same
  service, prefilled flow).

Reminders (local notifications)
- Permission requested in context (after the first booking request, with a
  short explanation), never on app launch.
- On accepted booking: schedule local reminders 24 h and 1 h before. Reschedule
  or cancel them when the booking changes or is cancelled. Tapping a reminder
  deep-links into the booking detail.
- Settings screen toggle to disable reminders.

After the appointment
- Review sheet slides up the next time the customer opens the app after a
  completed booking: tap stars with haptic, optional text, done in two taps.
- "Fade-Rhythmus": after a completed cut, offer "Erinnere mich in 3 / 4 / 6
  Wochen" to schedule a local reminder "Zeit für einen frischen Schnitt?"
  that deep-links to rebooking the same barber and service.
- After the 3rd completed booking, request an in-app store rating via
  expo-store-review (already installed), at most once.

Account
- Profile header with avatar, name, member since.
- "Deine Schnitte": history timeline of completed bookings with barber and
  service.
- Saved addresses management, favorites, notification settings, language,
  legal texts, help, sign out, delete account.

## Wave 3: Barber journey

- Tapping the location anywhere (Studio, profile) opens the location editor.
- Requests: sections as described in issues. Swipe right to accept, swipe left
  to reject (with confirm sheet and reason), buttons stay available for
  accessibility. Accept triggers a success haptic and a smooth card transition
  into "Upcoming".
- After accepting: offer "Zum Kalender hinzufügen" and "Route öffnen"
  (Apple Maps / Google Maps via Linking with the customer address, no native
  dependency).
- "Ich bin unterwegs" one-tap action on today's bookings: opens a sheet with ETA
  chips (10 / 15 / 30 min) and sends a pre-written chat message to the
  customer ("Ich bin unterwegs, bin in ca. 15 Minuten da."). Also "Bin da" and
  "5 Minuten später" quick actions.
- Studio "Heute" agenda: today's appointments as a vertical timeline with times,
  customer names, addresses and gaps between them. Next appointment card with
  countdown and route button.
- Availability: visual week view with time blocks, "Tag kopieren", templates,
  and closed days / vacation (blackout dates, the long-open founder question:
  implement as a new availability row type or table via proper migration, and
  make busy-slot and booking validation respect it).
- Services: drag to reorder, price and duration steppers, live preview of how
  the service card looks to customers.
- "So sehen dich Kunden": preview button that opens the barber's own public
  profile exactly as customers see it.
- Share profile + QR code: barbers can share their profile link or show a QR
  code (generated with react-native-svg based QR, JS-only) to bring their
  existing clients into Privelier. Deep link opens the profile.
- Verification: once approved, "Verifiziert seit <date>" badge, documents
  collapsed.
- Dashboard (already strong): add count-up animations, chart draw-in
  animation, tap a chart bar to see the week's details.

## Wave 4: Chat

- Pinned booking context card at the top (service, date, time, status pill),
  tap opens booking detail.
- Header: avatar, name, service, appointment date.
- Day separators ("Heute", "Gestern", date), consecutive bubbles grouped,
  time shown per group or on long press, read receipt only on the last own
  message.
- Send button animates from muted to brass when text is present, haptic on
  send, message slides in.
- Barber quick replies above the input: "Bin unterwegs", "Bin da",
  "5 Min. später", "Passt!", editable before sending.
- Long press a message: copy (expo-clipboard), with haptic.
- Detect phone numbers and addresses and make them tappable.
- Typing indicator and unread handling already exist: polish their motion.

## Wave 5: System integrations

- Calendar (expo-calendar) for customers and barbers, as described above.
  Store the created event id locally so "Im Kalender" state can be shown and
  updated or removed if the booking changes.
- Maps deep links for directions (no native dependency).
- Deep links: privelier://booking/<id>, privelier://barber/<id>,
  privelier://chat/<id>, handled from notifications and shares, with auth
  gating (after login, continue to the requested screen).
- Home screen quick actions (long-press app icon): "Termin buchen",
  "Meine Termine", "Nachrichten". Only if a well-maintained Expo-compatible
  package exists; include it in the native batch.
- Optional biometric app unlock (expo-local-authentication) as a setting, off
  by default. Include in the native batch only if it fits cleanly.

## Wave 6: Localization (German + English)

- Introduce an i18n layer (expo-localization + i18n library of your choice).
  Every user-facing string moves to translation files: de (primary) and en
  (fallback). No hardcoded UI strings remain.
- German copy: natural, warm, direct, du-form, concise, sentence case.
  Match the brand voice of the ad campaign ("Dein Barber kommt zu dir.").
  Not machine-literal translations.
- Dates, times, currency and numbers formatted per locale (de-DE: "Mo., 28.
  Sep. · 12:35", "30 €").
- Permission usage strings, notification texts and calendar event texts in
  both languages.
- Language setting in Account: "Automatisch (Gerät)", Deutsch, English.
- Add a test that fails if any translation key is missing in either language.

## Wave 7: Trust, safety and store readiness

- Report and block: users can report a barber profile, a review or a chat
  message, and block a user (App Store guideline 1.2 requires this for
  user-generated content). Reports go into a table readable only by admins.
  Blocked users cannot message each other.
- Account deletion in-app (required by Apple), with a clear explanation of what
  is deleted and what must be kept (e.g. booking records), implemented via a
  secure server-side function.
- Bio and review length limits and basic profanity/abuse screening on save.
- Legal texts screens (already in progress) reachable from Account.

## Idea parking lot (document only, do not build now)

- iOS Live Activity / Android ongoing notification "Barber ist unterwegs" with
  ETA.
- Home screen widget "Nächster Termin".
- Reference photo upload in the booking ("So hätte ich es gern").
- Before/after pairs in the portfolio.
- Weather-aware Discover line ("Regen heute? Dein Barber kommt zu dir.").
- Tipping and payments once Stripe is approved.
- Referral program once an offer is officially approved.

## Definition of done per wave

- Every item implemented or explicitly moved to the parking lot with a reason.
- Typecheck, lint, full test suite green; Maestro flows updated.
- docs/design/wow-pass.md updated with decisions and remaining gaps.
- No fake data, no new booking states, no unapproved scope.
- Pushed to origin/main.
- A short report to Taha: what changed, what to look at on the phone (exact
  screens and gestures), and whether a new dev build is required.

Start with Wave 0 now. Work through the waves in order without waiting for
approval between items, except where a migration needs to be applied by Taha
or a founder decision is genuinely missing.
