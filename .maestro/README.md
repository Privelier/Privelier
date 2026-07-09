# Maestro E2E flows (auth, build-order step 5; customer discovery, build-order
# step 9-10; booking creation, build-order step 11-12)

These flows were authored during pipeline stages 6-7 (test-engineer) but have
**not been executed**: this development machine has no Maestro CLI, no
Android SDK, and no emulator installed. Do not assume they are correct until
they have actually been run once.

## Running them (once tooling is available)

```
maestro test .maestro/login-provisioning-role-landing.yaml
maestro test .maestro/signup-await-confirmation-resend.yaml
maestro test .maestro/barber-services-add-edit-delete.yaml
maestro test .maestro/barber-availability-add-edit-delete.yaml
maestro test .maestro/customer-discovery-view-barber-profile.yaml
maestro test .maestro/customer-booking-create.yaml
maestro test .maestro/barber-requests-accept-reject.yaml
maestro test .maestro/customer-chat-send-message.yaml
```

All seven flows use a placeholder `appId: com.privelier.app` — `app.json` does
not yet define `android.package` / `ios.bundleIdentifier`, so there is no real
app id to target yet. Set a real one in `app.json` (and rebuild a dev client)
before these can actually run, then update the `appId` in all files to match.

All flows also take credentials/emails via `env:` in the YAML with sane
placeholder defaults, overridable at the CLI with `-e KEY=value` — see the
comments in each file for exactly what to provide.

## Why these flows

Per the CLAUDE.md orchestration pipeline, the booking accept/reject flow and
chat are the highest-priority E2E targets overall (realtime + optimistic UI),
but auth and barber services/availability are what's built so far. Within
auth, `login-provisioning-role-landing.yaml` and
`signup-await-confirmation-resend.yaml` cover the highest-value paths: the
full session-driven root switch (Contract A) landing on the correct role
app, and the signup -> await-confirmation -> resend loop.

For build-order step 7-8 (barber services & availability, authored in
pipeline stage 7), `barber-services-add-edit-delete.yaml` and
`barber-availability-add-edit-delete.yaml` cover add -> edit -> delete for
each data type; the availability flow additionally exercises the
day-of-week/specific-date mode toggle by adding a window in one mode and
editing it into the other, since that mutual-exclusivity interaction is the
single most meaningful piece of client-side logic on that screen. Same
caveat as the auth flows: authored only, not yet run, for the same
Maestro-CLI/emulator-less-machine reason.

Row-level testIDs on both barber screens are per-row
(`barber-services-row-{id}`, `-edit-{id}`, `-delete-{id}`, and the
availability equivalents) since the id is a server-generated uuid unknown at
authoring time. The two barber flows use Maestro's regex support on `id`
(e.g. `barber-services-edit-.*`) to match "the only row currently on
screen" — safe because each flow only ever has the single row it created
itself visible at the point a regex selector is used.

## Deliberately not written yet

Two flows were explicitly out of scope for this pass because they need real
backend state that's hard to author meaningfully without running the first
two flows once to observe actual behavior first:

- **Duplicate-email signup.** Needs an email that is already registered
  server-side (Supabase's duplicate-email obfuscation — a fake user with an
  empty `identities` array — is exercised in the authService unit tests, but
  the E2E version needs a real pre-existing account to sign up against).
- **App-kill-mid-provisioning recovery.** Needs to kill the app while
  `ensureProfile()` is in flight (between login and the `users` row commit)
  and confirm relaunch resumes provisioning correctly. This is inherently a
  timing-sensitive scenario best authored after seeing real provisioning
  timing on-device.

Add both once `login-provisioning-role-landing.yaml` and
`signup-await-confirmation-resend.yaml` have been run successfully at least
once on a real device/emulator.

For build-order step 9-10 (customer discovery, authored in pipeline stage 7),
`customer-discovery-view-barber-profile.yaml` covers the highest-value path:
a customer sees an approved, same-city barber on the home screen, taps it,
and lands on that barber's profile with its services visible. Since the
barber row is a fetched, server-generated row (no known testID at authoring
time, same limitation as the barber-services/availability rows), the flow
matches it by visible name text (`TEST_BARBER_NAME`) rather than a
`customer-home-barber-{id}` testID — the prerequisites comment in the file
spells out exactly what backend state (an approved, same-city test barber
with a seeded service) the flow needs before it can run.

For build-order step 11-12 (booking flow, authored in this pipeline stage),
`customer-booking-create.yaml` covers the highest-value path: a customer
taps "Book" on a barber's service, walks the three-screen booking flow
(date/time -> location -> confirm), sees the success state, and the new
booking is then actually visible on their own Bookings tab. It builds on the
same discovery prerequisites (approved, same-city test barber) plus two more
that are specific to this flow: exactly one seeded service (so the
per-service `barber-profile-book-{id}` testID's regex match is unambiguous,
the same "only one thing is visible when a regex selector is used" rule as
the barber flows' row selectors), and availability windows covering every
weekday with wide hours (so day-chip index 0, i.e. "today" — whatever day
the flow happens to run on — reliably has an open slot; the flow always
picks day index 0 and the earliest available time via `index: 0` on the
per-time slot testID regex, since which times are open depends on the
current time of day and cannot be known at authoring time). See the file's
own header comment for the exact env vars and full reasoning.

For build-order step 13-14 (barber requests & realtime status, authored
retroactively 2026-07-09 when that step's skipped pipeline stages were closed
out), `barber-requests-accept-reject.yaml` covers the CLAUDE.md-designated
highest-priority E2E target: the barber accepts one pending request (one-tap,
optimistic flip, server reconciliation) and rejects a second through its
destructive-confirmation alert, then the flow asserts both final status
labels, the absence of inline rollback errors, and that no accept/reject
button remains (terminal/accepted rows offer different actions). It needs
EXACTLY TWO pending bookings seeded (run `customer-booking-create.yaml`
twice) — the file's header explains why two, and why the per-uuid button
testIDs are matched by regex + `index: 0`. Deliberately NOT covered: the
customer's Bookings tab updating live at the moment of acceptance — that
needs two simultaneous sessions, which single-device Maestro cannot do, so
the realtime half of the step 13-14 gate remains a manual two-device check.

For build-order step 15-16 (chat), `customer-chat-send-message.yaml` covers
the single-device half: customer opens the Inbox's (single seeded) thread,
sends a message, and the flow asserts the POST-echo state — the transient
"Sending…" bubble resolving into the server-confirmed message bubble — not
the optimistic frame. Rooms exist automatically per booking since migration
0013, so seeding is just "exactly one booking". The gate's "both directions"
half (barber receives live and replies) is a manual two-device check, same
as step 13-14's realtime half. New testIDs (documented for both apps, same
shape with the `barber-` prefix): `customer-conversation-screen`, `-back`,
`-loading`, `-error`, `-empty`, `-input`, `-send`,
`customer-conversation-message-{id}`, `-sending-{key}`, `-failed-{key}`.

## testIDs referenced (verified present in source as of this writing)

`role-select-customer`, `role-select-barber`, `auth-entry-screen`,
`auth-entry-login`, `auth-entry-signup`, `auth-login-screen`,
`auth-login-email`, `auth-login-password`, `auth-login-submit`,
`auth-signup-screen`, `auth-signup-name`, `auth-signup-email`,
`auth-signup-password`, `auth-signup-city`, `auth-signup-submit`,
`auth-confirm-screen`, `auth-confirm-resend`, `auth-confirm-success`,
`auth-confirm-error`, `barber-dashboard-logout`,
`barber-dashboard-services`, `barber-dashboard-availability`
(all three now live on the Studio tab of the barber tab shell —
`barber-dashboard-screen`, with `-loading`, `-error`, and `-verification`
state ids; tab-bar buttons are
`barber-tab-{studio|requests|portfolio|chats|verify}` and the
the Requests tab has `barber-requests-screen`, `-loading`,
`-error`, `-empty`, and `barber-requests-row-{id}`; the Portfolio
tab has `barber-portfolio-screen`, `-loading`, `-error`,
`barber-portfolio-add`, and `barber-portfolio-image-{id}`; the Chats tab
has `barber-chats-screen`, `-loading`, `-error`, `-empty`, and
`barber-chats-row-{id}`; the Verify tab has `barber-verify-screen`,
`-loading`, `-error`, `barber-verify-status`, `barber-verify-doc-id`, and
`barber-verify-doc-license`),
`barber-services-screen`, `barber-services-name`, `barber-services-price`,
`barber-services-duration`, `barber-services-submit`,
`barber-services-cancel-edit`, `barber-services-row-{id}`,
`barber-services-edit-{id}`, `barber-services-delete-{id}`,
`barber-availability-screen`, `barber-availability-mode-day`,
`barber-availability-mode-date`, `barber-availability-day-{0-6}`,
`barber-availability-date`, `barber-availability-start-time`,
`barber-availability-end-time`, `barber-availability-submit`,
`barber-availability-cancel-edit`, `barber-availability-row-{id}`,
`barber-availability-edit-{id}`, `barber-availability-delete-{id}`,
`customer-home-screen`, `customer-home-loading`,
`customer-home-error`, `customer-home-empty`, `customer-home-barber-{id}`,
`customer-tab-{discover|explore|bookings|inbox|account}` (tab-bar buttons),
`customer-account-screen`, `customer-account-logout` (sign-out moved here
from the old customer-home-logout when the customer UI was rebuilt against
the Lovable prototype's tabbed shell),
`customer-account-row-{favorites|notifications|privacy|preferences|help}`,
`customer-account-section-screen`, `customer-account-section-back`,
`customer-bookings-screen`, `customer-bookings-tab-{upcoming|past}`,
`customer-bookings-loading`, `customer-bookings-error`,
`customer-bookings-empty`, `customer-bookings-row-{id}`,
`customer-inbox-screen`, `customer-inbox-loading`, `customer-inbox-error`,
`customer-inbox-empty`, `customer-inbox-row-{id}`,
`barber-profile-screen`, `barber-profile-back`, `barber-profile-loading`,
`barber-profile-error`, `barber-profile-not-found`, `barber-profile-rating`,
`barber-profile-services-error`, `barber-profile-services-empty`,
`barber-profile-service-{id}`, `barber-profile-book-{id}`,
`barber-profile-tab-{services|portfolio|reviews}` (Services is the default
tab, so existing service assertions need no extra taps),
`barber-profile-portfolio-placeholder`,
`customer-booking-datetime-screen`, `customer-booking-datetime-back`,
`customer-booking-datetime-loading`, `customer-booking-datetime-error`,
`customer-booking-datetime-empty`, `customer-booking-datetime-day-{index}`,
`customer-booking-datetime-no-times`, `customer-booking-datetime-slot-{time}`,
`customer-booking-datetime-continue`,
`customer-booking-location-screen`, `customer-booking-location-back`,
`customer-booking-location-input`, `customer-booking-location-continue`,
`customer-booking-confirm-screen`, `customer-booking-confirm-back`,
`customer-booking-confirm-error`, `customer-booking-confirm-pick-another-time`,
`customer-booking-confirm-submit`, `customer-booking-confirm-success`.

Build-order step 13-14 (barber requests & realtime status transitions) adds
per-card action/state testIDs on the two booking screens. On the barber
Requests tab: `request-accept-{id}`, `request-reject-{id}` (pending cards),
`request-complete-{id}`, `request-cancel-{id}` (accepted cards),
`barber-requests-actions-{id}` (the action row wrapper),
`barber-requests-row-busy-{id}` (in-flight spinner while a mutation is
awaited), and `barber-requests-row-error-{id}` (inline rollback error notice,
`accessibilityRole="alert"`). On the customer Bookings tab:
`booking-cancel-{id}` (cancel action, shown only on pending/accepted rows),
`customer-bookings-row-busy-{id}` (in-flight spinner), and
`customer-bookings-row-error-{id}` (inline rollback error notice). All are
per-row because the id is a server-generated uuid unknown at authoring time;
a step 13-14 E2E flow should assert on POST-echo state (the card's status
label + the busy id clearing) rather than the pre-write optimistic frame,
since the optimistic status and the realtime echo converge to the same value.
Note: `barber-requests-loading` / `customer-bookings-loading` now render only
on the FIRST load (while the list is still empty) — a focus refetch over an
already-populated list is silent so realtime updates don't blank the list.

If any of these have changed since, re-grep `testID=` under `src/` before
trusting this list.
