# Founder actions

Steps that need a dashboard, an account owner or a product decision. Work top to bottom: the order matters for the first five (the app now reads the publishable key, so it must exist everywhere before any legacy key is disabled).

## Now (the app depends on these)

- [ ] **F1. Rename the client key everywhere.** The app reads `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and refuses to start without it (`lib/env.ts`).
  - Local `.env` on every machine: replace `EXPO_PUBLIC_SUPABASE_ANON_KEY=...` with `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_... from Supabase > Project Settings > API Keys>`. Ali's machine is already done.
  - EAS: `eas env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <sb_publishable_...> --environment production --environment preview --environment development --visibility plaintext`, then delete `EXPO_PUBLIC_SUPABASE_ANON_KEY` from EAS.
- [x] **F2. Deploy the updated `delete-account` Edge Function.** Deployed on 2026-10-27 with Ali's approval (version 3, active, JWT verification on; an unauthenticated call returns 401).
- [ ] **F3. Move the GitHub Actions secret off the legacy service key.** The code side is done: `barber-stats.yml` now reads `SUPABASE_SECRET_KEY`, the job sends an `sb_secret_` key in `apikey` only, and migration 0059 grants the job exactly the columns it reads. Remaining: with `SUPABASE_ACCESS_TOKEN` set and `gh` logged in, run `py tools/automation/setup_github_secrets.py` once (it stores the `sb_secret_` key as `SUPABASE_SECRET_KEY` without printing it, deletes the old `SUPABASE_SERVICE_ROLE_KEY` secret and triggers one run), then check the run with `gh run watch`. If the project has no secret key yet, create one first in Project Settings > API Keys.
- [ ] **F4. Ship a build that uses the publishable key** (EAS build for both stores), and wait until it is the minimum supported version.
- [ ] **F5. Disable the legacy `anon` and `service_role` keys** (Supabase > Project Settings > API Keys > Legacy) before Supabase removes them at the end of 2026. Do this only after F1 to F4.

## Credentials

- [ ] **F6. Revoke an old personal access token.** A Supabase personal access token (`sbp_...`, an older one, not the current token) was stored in plain text in a saved permission rule in `.claude/settings.local.json`. The file is git-ignored and never reached git history (gitleaks clean). The rule was removed on 2026-10-27; what remains is revoking the token at supabase.com > Account > Access Tokens.
- [ ] **F7. Revoke the old Mapbox token and EAS secret.** Maps moved to MapLibre; the public Mapbox token is no longer used anywhere in code. Delete it in the Mapbox account and remove `RNMAPBOX_DOWNLOAD_TOKEN` from EAS.
- [ ] **F8. Keep a secrets inventory** in the password manager with owner and rotation steps for each:

  | Secret | Lives in | Rotated by |
  |---|---|---|
  | Supabase secret key (`sb_secret_`) | Edge Function env (injected), GitHub Actions secret | Supabase dashboard, then F3 |
  | Supabase database password | Password manager only | Supabase > Database settings |
  | Supabase personal access tokens | Each founder's user environment variable | supabase.com > Account |
  | SMTP credentials (auth email) | Supabase > Auth > SMTP | Mail provider, then Supabase |
  | EAS / Expo token | Expo account | expo.dev > Access tokens |
  | Apple distribution certificate and push key | EAS credentials | Apple Developer, then `eas credentials` |
  | Android upload keystore | EAS credentials plus offline backup | See F9 |
  | Google OAuth client secret | Supabase > Auth > Providers | Google Cloud console |
  | Apple Sign in key | Supabase > Auth > Providers | Apple Developer |

- [ ] **F9. Back up the Android upload keystore** (`eas credentials` > Android > download) to the password manager, and confirm Play App Signing is on in the Play Console so a lost upload key can be reset.

## Supabase dashboard

- [ ] **F10. Realtime: turn off "Allow public access"** (Project Settings > Realtime). The only Broadcast channel (typing) is already private; chat and booking updates use Postgres Changes, which Supabase documents as allowed on public and private channels. After switching, check on a device that chat messages, booking status and typing still arrive; switch back and report if not. Founder decision 2026-10-27: do this together with a device check, not blind.
- [ ] **F11. Auth hardening** (Authentication settings):
  - Email confirmation on; OTP and link expiry 3600 seconds or less.
  - Rate limits: lower sign-up, OTP and verification limits to what two founders expect (the default allows 360 OTPs per hour per project).
  - Leaked-password protection on (Supabase lists it as disabled; it needs the Pro plan).
  - Redirect URLs: exact entries only (`privelier://auth-callback` and the exact web URLs), no wildcards.
  - Live values read on 2026-10-27 through the Management API: email confirmation on, email OTP expiry 3600 s, redirect allow list exactly `privelier://auth-callback`, email sends 2 per hour, OTP and verify 30 each, refresh-token rotation on, reauthentication required to change a password, password rule lower + upper + digit + symbol with minimum length 6, leaked-password protection off, CAPTCHA off. OTP and verification limits lowered to 10 per hour on 2026-10-27 (founder decision, set through the Management API). Still open: leaked-password protection (Pro plan; not taken with D25) and CAPTCHA below.
  - CAPTCHA (Cloudflare Turnstile): the app is ready. Create a Turnstile widget whose allowed hostname matches `EXPO_PUBLIC_CAPTCHA_ORIGIN` (default `privelier.app`), set `EXPO_PUBLIC_CAPTCHA_SITE_KEY` (and the origin, if different) in EAS, ship that build, and only then enable Bot protection in Supabase with the widget's secret key. Enabling it before the build ships blocks sign-in on older versions.
- [ ] **F12. Organisation security:** MFA for every member of the Supabase organisation, remove anyone who does not need access, and set a spend cap or usage alerts.
- [x] **F13. API max rows:** confirmed 1000 on 2026-10-27 through the Management API (every app list caps itself at 300 or fewer).
- [ ] **F14. Backups.** Decided on 2026-10-27: a free nightly encrypted `pg_dump` on GitHub Actions (`.github/workflows/db-backup.yml`, decision D25) instead of the Pro plan. Remaining: set the `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` secrets and run it once, then do the restore drill once (`docs/hardening/BACKUPS.md`).

## Product decisions

- [x] **F15. Travel time between appointments.** Decided on 2026-10-27: 30 minutes after every active booking (decision D4, migration 0060, live).
- [x] **F16. One app or two store listings.** Decided on 2026-10-27: one app, `com.privelier.app`, with the customer/barber choice (decision D18).
- [x] **F17. Content denylist.** Reviewed on 2026-10-27: the current list (decision D19) stays for launch. Extend it later in `private.content_denylist` (`insert into private.content_denylist (term) values ('...');`); matching is whole-word, case-insensitive.
- [ ] **F18. Safety and reports process.** Decided on 2026-10-27 (decision D24): both founders, reports within 24 hours, SOS at once; warn, then suspend, then remove. Migration 0061 (live) pushes an alert to the staff list. `privelier@outlook.com` was added to the staff list on 2026-10-27 (no device registered yet). Remaining: sign in with that account on a phone and allow notifications; to add the other founder later: `insert into private.safety_staff (user_id) select id from auth.users where email = '<your email>';`

## Store submission

- [ ] **F19. Web account-deletion page.** The page is ready (`site/delete-account.html`, English and German, matching the in-app flow and decision D7) and `.github/workflows/pages.yml` publishes only `site/`. Remaining: enable Pages once (repository Settings > Pages > Source: GitHub Actions), run `gh workflow run pages.yml`, open `https://privelier.github.io/Privelier/delete-account.html`, and enter that URL in Play Console > Data safety. The page promises email requests are handled within 30 days; change it if that is not the intended commitment.
- [ ] **F20. Publish the real legal texts** with the zero-tolerance clause for objectionable content, then bump the legal versions (see `CLAUDE.md`, "Legal consent versioning"); every user re-accepts.
- [ ] **F21. Demo accounts for review.** Create the reviewer accounts described in `docs/release/app-review-notes-*.md` (one customer, one pre-approved barber with services and availability) and put their credentials only into App Store Connect and the Play Console.
- [ ] **F22. App Privacy and Data safety forms.** The answers are written field by field in `docs/release/store-privacy-forms.md`. Remaining: enter them in App Store Connect and the Play Console.

## Checks that need a device or build

- [ ] **F23. GPS removal on uploads:** upload a photo with GPS to the portfolio from a device build, download it from the public URL and run `exiftool <file>`; there must be no GPS tags.
- [x] **F24. 16 KB page size:** verified on 2026-10-27 without a full build by `py tools/android/check_16kb.py`: all 38 arm64-v8a / x86_64 libraries in the pinned prebuilt artifacts (React Native 0.88, Hermes, fbjni, SoLoader, Fresco native modules, MapLibre 13.6.1, AVIF, zstd) have 16 KB LOAD alignment; modules compiled from source get `ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` from the React Native Gradle plugin (NDK 27.1); AGP 9.2.1 with legacy packaging off stores them uncompressed and 16 KB zip-aligned. Rerun the script after each Expo or React Native upgrade, and once on the first production AAB: `py tools/android/check_16kb.py app-release.aab`.
- [ ] **F25. Maestro and two-device checks:** run `.maestro/` flows and the two-session Realtime booking and chat checks on Android and iOS development builds (`AGENTS.md` Step 18).
- [ ] **F26. Install the secret scanner locally** on each founder machine: install gitleaks, then run `bash tools/hooks/install-gitleaks-hook.sh` once per clone. Ali's machine: done (gitleaks 8.30.1, hook active). The other founder's machine: open.
