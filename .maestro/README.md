# Maestro E2E flows (auth, build-order step 5; customer discovery, build-order
# step 9-10)

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
```

All five flows use a placeholder `appId: com.privelier.app` — `app.json` does
not yet define `android.package` / `ios.bundleIdentifier`, so there is no real
app id to target yet. Set a real one in `app.json` (and rebuild a dev client)
before these can actually run, then update the `appId` in all files to match.

All five flows also take credentials/emails via `env:` in the YAML with sane
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

## testIDs referenced (verified present in source as of this writing)

`role-select-customer`, `role-select-barber`, `auth-entry-screen`,
`auth-entry-login`, `auth-entry-signup`, `auth-login-screen`,
`auth-login-email`, `auth-login-password`, `auth-login-submit`,
`auth-signup-screen`, `auth-signup-name`, `auth-signup-email`,
`auth-signup-password`, `auth-signup-city`, `auth-signup-submit`,
`auth-confirm-screen`, `auth-confirm-resend`, `auth-confirm-success`,
`auth-confirm-error`, `customer-home-logout`, `barber-dashboard-logout`,
`barber-dashboard-services`, `barber-dashboard-availability`,
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
`customer-home-screen`, `customer-home-logout`, `customer-home-loading`,
`customer-home-error`, `customer-home-empty`, `customer-home-barber-{id}`,
`barber-profile-screen`, `barber-profile-back`, `barber-profile-loading`,
`barber-profile-error`, `barber-profile-not-found`, `barber-profile-rating`,
`barber-profile-services-error`, `barber-profile-services-empty`,
`barber-profile-service-{id}`.

If any of these have changed since, re-grep `testID=` under `src/` before
trusting this list.
