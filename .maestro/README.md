# Maestro E2E flows (auth, build-order step 5)

These flows were authored during pipeline stage 6 (test-engineer) but have
**not been executed**: this development machine has no Maestro CLI, no
Android SDK, and no emulator installed. Do not assume they are correct until
they have actually been run once.

## Running them (once tooling is available)

```
maestro test .maestro/login-provisioning-role-landing.yaml
maestro test .maestro/signup-await-confirmation-resend.yaml
```

Both flows use a placeholder `appId: com.privelier.app` — `app.json` does not
yet define `android.package` / `ios.bundleIdentifier`, so there is no real
app id to target yet. Set a real one in `app.json` (and rebuild a dev client)
before these can actually run, then update the `appId` in both files to
match.

Both flows also take credentials/emails via `env:` in the YAML with sane
placeholder defaults, overridable at the CLI with `-e KEY=value` — see the
comments in each file for exactly what to provide.

## Why only these two flows

Per the CLAUDE.md orchestration pipeline, the booking accept/reject flow and
chat are the highest-priority E2E targets overall (realtime + optimistic UI),
but auth is what's built so far. Within auth, these two cover the highest-
value paths: the full session-driven root switch (Contract A) landing on the
correct role app, and the signup -> await-confirmation -> resend loop.

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

## testIDs referenced (verified present in source as of this writing)

`role-select-customer`, `role-select-barber`, `auth-entry-screen`,
`auth-entry-login`, `auth-entry-signup`, `auth-login-screen`,
`auth-login-email`, `auth-login-password`, `auth-login-submit`,
`auth-signup-screen`, `auth-signup-name`, `auth-signup-email`,
`auth-signup-password`, `auth-signup-city`, `auth-signup-submit`,
`auth-confirm-screen`, `auth-confirm-resend`, `auth-confirm-success`,
`auth-confirm-error`, `customer-home-logout`, `barber-dashboard-logout`.

If any of these have changed since, re-grep `testID=` under `src/` before
trusting this list.
