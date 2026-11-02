# Privelier release-readiness report

Audit date: 2026-11-01. Baseline commit `bcf1ee9` on `main` plus the fixes listed in section 2. Environment: Windows 10 workstation, Supabase production project in rolled-back transactions only (no Docker, so no local stack; see "Method and limits"). This report was written because the release-readiness goal names it as a deliverable.

## 1. Executive summary

| Store | Verdict | Why |
|---|---|---|
| Apple App Store | **No-go** | The in-app privacy notice, both terms and the Impressum are marked "ENTWURF, NOCH NICHT RECHTSVERBINDLICH" (draft placeholders). No published privacy policy URL exists for the metadata (5.1.1(i), 2.1, 1.2 terms). Also blocked: custom SMTP for signup email, demo accounts, device runs. |
| Google Play | **No-go** | The same legal-text blocker. The Data safety form needs a privacy policy URL, the public deletion page is not live yet (Pages not enabled), and the location foreground service needs its Play Console declaration. |

The engineering side is in good shape:

- All eleven database invariants are proven by pgTAP, 9 suite files (migration 0070 now live): 246 counted assertions plus three contract files.
- The Security Advisor reports zero ERROR lints.
- There are no secrets in git history or in either production bundle.
- After this audit's patch bump, no High or Critical dependency advisories remain.
- Type check, ESLint, Jest, knip, jscpd, madge and expo-doctor are clean.

What keeps both stores at no-go is founder and legal work (section 4), not code.

**The goal's premises differ from the repository in four ways.** The report follows the repository and records each difference:

- **One app, not two.** The repository ships one binary, `com.privelier.app`, with a customer/barber choice (founder decision F16 / D18, 2026-10-27). Guideline 4.3 "two apps from one codebase" therefore does not apply. One listing describes both sides.
- **The website has no signup.** `site/` contains only `index.html` and `delete-account.html`. "Website signup follows the same rules" is N/A until a web signup exists.
- **Push, live arrival tracking with hold-for-SOS, and Google/Apple sign-in are built.** They were approved by founder decisions on 2026-10-25 and in D1. The report audits them instead of treating them as absent.
- **`privelier-test-links.md` does not exist** in the project root or anywhere in the repository. Guideline texts were checked against the current official pages where noted, and the Oct 16, 2026 Apple revision could not be cross-read from a provided index.

## 2. Findings

Severity is the release impact. Status values: **Fixed** (in this commit, with a re-run proof), **Human** (needs a founder, legal or console action), **Accepted** (a recorded decision) or **Info**.

| ID | Sev | Finding | Evidence | Mapping | Fix / owner | Status |
|---|---|---|---|---|---|---|
| R1 | Critical | All four in-app legal texts are drafts. No privacy policy URL exists for the store metadata, and there is no zero-tolerance UGC clause in terms the user accepts. | `src/legal/documents/*.ts` line 1: "ENTWURF, NOCH NICHT RECHTSVERBINDLICH"; `privacy.ts`, `customerTerms.ts:21`, `barberTerms.ts:19` | Apple 5.1.1(i), 2.1, 1.2; Play User Data and UGC policies | Publish the real texts with the zero-tolerance clause, host the privacy policy at a public URL and bump the legal versions (CLAUDE.md "Legal consent versioning"). Founders and counsel. FOUNDER_ACTIONS F20. | Human |
| R2 | High | The Google and Apple sign-in buttons always rendered, but both providers are **disabled** on the live project. Every tap ended in "provider unavailable": a broken feature in review. | Management API `config/auth`: `external_google_enabled=false`, `external_apple_enabled=false`; `LoginScreen.tsx:165`, `SignupScreen.tsx:292` before the fix | Apple 2.1, 4.8 | Buttons now follow `EXPO_PUBLIC_OAUTH_PROVIDERS`, hidden when it is unset. On iOS, Google shows only together with Apple (`src/auth/authService.ts` `isOAuthProviderEnabled`). Test: `src/auth/__tests__/oauthProviders.test.ts` (4 cases). To turn the providers on: F27. | Fixed |
| R3 | High | The public barber profile showed UGC (bio, portfolio photos, profile photo) with no report or block entry point. Report and block were reachable only inside a booking chat, so a customer without a booking could not flag a profile. | Before the fix, `<SafetyMenu` appeared only in `src/shared/components/ConversationView.tsx:80` | Apple 1.2; Play UGC | The profile hero now has the shared Safety menu (report the barber, block or unblock) with `bookingId: null`, which the live `user_reports_insert_own` policy allows (`ProfileChrome.tsx`, `SafetyMenu.tsx`). Test: `BarberProfileScreen.loading.test.tsx` "offers report and block…". | Fixed |
| R4 | High | Supabase's built-in mailer is in use (no custom SMTP), with `rate_limit_email_sent = 2` per hour for the whole project. At launch the third signup in an hour gets no confirmation email, and signup requires confirmation. | `config/auth`: `smtp_host` unset, `mailer_autoconfirm=false`, `rate_limit_email_sent=2` | Apple 2.1 (reviewers creating an account); availability | Configure custom SMTP and raise the email limit. Founders. F28. | Human |
| R5 | High | Both High advisories (`zod` < 4.6.6 and the `node-forge` chain in `@expo/cli`) appeared in `npm audit --omit=dev`. | `npm audit` before: "14 vulnerabilities (1 low, 11 moderate, 2 high)" | CWE-400, CWE-347 | `npx expo install --fix` (patch bumps `expo` 58.0.22, `expo-dev-client` 58.0.18, `expo-task-manager` 58.0.13, `react-native-screens` 4.30.1). After: "12 moderate severity vulnerabilities", all in Expo build tooling that is not in the app bundle (D10). | Fixed |
| R6 | Medium | `expo-doctor` failed (4 patch mismatches). | Before: "19/20 checks passed" | Release hygiene | Same patch bump. After: "20/20 checks passed. No issues detected!" | Fixed |
| R7 | Medium | `ios.supportsTablet: true` although no iPad layout was ever verified. Once an iPhone+iPad build ships, iPad support cannot be removed in an update. | `app.json` | Apple 2.1 (iPad review), 2.4.1 | Set to `false`. Turn it back on only after a full iPad pass. | Fixed |
| R8 | Medium | A generic Face ID purpose string ("Allow $(PRODUCT_NAME) to access your Face ID biometric data") was injected by `expo-secure-store`, although no code uses biometrics. | `npx expo config --type introspect` before; no `requireAuthentication` in `src`/`lib` | Apple 5.1.1(ii) | `expo-secure-store` plugin `faceIDPermission: false`. Introspect after: key removed. | Fixed |
| R9 | Medium | The in-app deletion sheet did not say what is retained. The web page did. | `DeleteAccountAction.tsx:62-64` vs `site/delete-account.html:57` | Apple 5.1.1(v) | The sheet now says (EN/DE) that safety reports and SOS records stay for review without the account link. The review notes say the same. | Fixed |
| R10 | Medium | 20 SECURITY DEFINER RPCs of the "Looks" feature are live and callable by `authenticated`, while their code and migrations sit on Taha's unmerged branch. | Security Advisor lint 0029 (33 functions: 13 justified in D15, 20 Looks) | MASVS-AUTH; CWE-284 | Reviewed on 2026-11-01 from the live definitions. Every function pins `search_path=''`, checks `auth.uid()`, the `looks` flag (off for all, two allow-listed accounts), role, ownership and state, and rate-limits writes. Photo access needs consent and publication, never crosses a block, and reference photos reach only the booked barber or an eligible offerer. New `supabase/tests/looks_authorization.test.sql` passes 11 assertions. Gap found: account deletion did not erase the `looks` and `look-references` buckets. `supabase/functions/delete-account/index.ts` now includes them, and it was deployed on 2026-11-01 (version 7, JWT verification on, an unauthenticated call returns 401). Version 9 (2026-11-02) also removes a customer's look photos, which live in the barber's folder. | Fixed |
| R11 | Medium | Server password minimum is 6 while the app requires 8, so a direct Auth API call accepts a 6-character password. Leaked-password protection is off. | `config/auth`: `password_min_length=6`, `password_hibp_enabled=false`; `src/auth/screens/validation.ts:13` | CWE-521; OWASP ASVS 2.1.1 | Server minimum set to 8 on 2026-11-01 through the Management API (`password_min_length = 8`, read back). Leaked-password protection still needs the Pro plan (D25). | Fixed (leaked-password protection: Human) |
| R12 | Medium | The location foreground service (`FOREGROUND_SERVICE_LOCATION`) and the iOS `location` background mode are used for live arrival. Both need a declaration at review. | Merged manifest permissions; `UIBackgroundModes: fetch, location`; `src/barber/trip/tripService.ts:269` | Apple 2.5.4; Play foreground service and Location policies | Barber review note updated. The Play Console foreground-service declaration (with video) is a founder step. F30. | Human |
| R13 | Low | `tools/db/overlap_concurrency_test.py` reported FAIL. Its "adjacent 11:00" control predates the 30-minute travel buffer (migration 0060), which correctly refuses 11:00. | Run output before: "C refused … FAIL" | Test accuracy | The control now uses 11:30, the first start after the buffer. The overlapping case is unchanged. Re-run: A inserted, B refused, C inserted, D inserted, PASS. | Fixed |
| R14 | Low | 16 Maestro flows carried a stale `# TODO: replace once app.json defines a real package` on the `appId` line. | `.maestro/*.yaml` | 2.1 hygiene (test assets) | Comment removed. The ID is real. | Fixed |
| R15 | Low | Semgrep `wildcard-postmessage-configuration`: `postMessage(..., '*')` to the map iframe. | `src/shared/maps/WebMap.web.tsx:33` | CWE-345 | The iframe is a `srcDoc` page sandboxed with `allow-scripts` only, so its origin is opaque and no named origin exists. It is web-only, the inbound handler checks `event.source`, and the payload holds only offset pins. | Accepted |
| R16 | Low | A block stops new messages and bookings and hides the barber from discovery. It does not hide an existing chat history or a blocked customer's review on the barber's profile. | `SafetyMenu.tsx` copy; `private.is_blocked_between` policies | Apple 1.2 | Acceptable for launch: the history belongs to both parties (D7). Revisit if reviewers ask. | Info |
| R17 | Info | Known gap "double booking blocks only identical start times" is **closed**: an exclusion constraint on half-open ranges plus the 30-minute buffer. | Matrix assertions 37, 44-48; concurrency proof PASS | Invariant integrity | None needed. | Info |
| R18 | Info | Known gap "a normally open date cannot be marked closed" is **closed**: `barber_days_off` (migration 0046). | Matrix assertions 82-84 | Product | None needed. | Info |
| R20 | Medium | Removing a review did not update the barber's average. `trg_recompute_barber_rating` fires `AFTER INSERT` only, so the founder removal path in D24 (`delete from public.reviews …`) left a stale public rating. | `pg_get_triggerdef`: `AFTER INSERT ON public.reviews`. `review_removal.test.sql` on the live schema: "have: 3.00, want: 5.00", 2 of 6 failed | Apple 1.2 (acting on reports); data integrity | Forward migration `supabase/migrations/0070_recompute_rating_on_review_delete.sql` recomputes after INSERT or DELETE. `supa.py dry-run`: ok. `supa.py test --with 0070 -- <all suites>`: 9/9 passed. Applied on 2026-11-01 with founder approval (`20261101113349`). After that, `npm run db:test` passes 9/9 and `npm run db:types` shows no diff. | Fixed |
| R19 | Info | Developer-machine issue found mid-run: `uv.exe`/`uvx.exe` disappeared from `~/.local/bin`, and Git for Windows' `mingw64\bin\git.exe` is missing, so the `git` wrapper reports "BUG (fork bomb)". `mingw64\libexec\git-core\git.exe` still works. | Session observation | Tooling | Reinstall Git for Windows and uv. Check antivirus quarantine. | Human |

## 3. Scorecards

### Security definition of done

| Item | Result | Evidence |
|---|---|---|
| Zero ERROR Supabase lints | Pass | Security Advisor: 0 ERROR. WARN: lint 0029 (13 justified in D15, 20 Looks functions per R10), leaked-password protection (R11). INFO: 6 RLS-enabled tables without policies (5 in `private`, `push_tokens` RPC-only by design, matrix assertion 86). Performance Advisor: INFO only (unused indexes on a small dataset, 5 unindexed FKs on Looks tables). |
| pgTAP invariants 1-11 | Pass | `python tools/db/supa.py test --with 0070 -- <all>`: 9/9 files passed. New `release_invariants.test.sql` (56 assertions) and `review_removal.test.sql` (6). 0070 is live, so a plain `npm run db:test` passes 9/9 as well. See section 5. |
| No secrets in code or history | Pass | `gitleaks git`: 349 commits, "no leaks found". `gitleaks dir` on fresh `expo export` bundles (iOS and Android): "no leaks found". The working-tree hits are git-ignored `.env` (publishable key), `.expo/dev/logs` and a stale `dist/`, and every JWT decodes to `role=anon`. The only `EXPO_PUBLIC_*` values are the URL, the publishable key and optional public endpoints and CAPTCHA site key. |
| No unaddressed High/Critical dependencies | Pass | `npm audit --omit=dev`: 12 moderate, 0 high, 0 critical (R5). |
| Type check, lint, expo-doctor clean | Pass | `npm run check` exit 0 (tsc, ESLint `--max-warnings 0`, Jest, knip, jscpd 1.38 %, madge no cycles). `npx expo-doctor`: 20/20. |
| Semgrep (p/javascript, p/typescript, p/react, p/secrets) | Pass | 508 files scanned, 0 errors, 1 WARNING (R15, accepted). |
| osv-scanner | Needs human action | Downloading the binary was refused by this session's permission policy. Run `osv-scanner scan source --lockfile=package-lock.json` once. `npm audit` covers the same lockfile through GHSA in the meantime. |
| Maestro on release builds | Needs human action | No Android device or emulator image exists on this machine (`adb devices` empty, no AVD), and iOS cannot be built on Windows. Flows added: `customer-account-delete.yaml`, `customer-chat-message-limit.yaml`. F25. |

### Apple App Store

| Requirement | Result | Evidence / owner |
|---|---|---|
| 2.1 No placeholder, lorem, TODO, coming soon, dead buttons or dev screens | **Fail → Human** | Legal placeholders (R1). The OAuth dead buttons are fixed (R2). No lorem or "coming soon" in the app: the "TODO" and "Demnächst" grep hits are a `DONE_TODO` map and the "Upcoming" section label. `src/dev/ComponentGallery` loads only behind `__DEV__` on web (`App.tsx:122`). |
| 2.1 Demo accounts with seeded data | Needs human action | One customer and one pre-approved barber with services, availability and portfolio; credentials only in App Store Connect. F21. |
| 2.1 Review notes explaining manual verification | Pass | `docs/release/app-review-notes-barber.md` "Verification (manual, no biometrics)". |
| 4.2 / 4.3 Distinct apps | Pass (N/A as two apps) | One binary with a role choice (D18). The notes explain both sides of the marketplace. |
| 1.2 Objectionable-content filter | Pass | `private.content_denylist`, enforced on messages and review comments (matrix assertion 56, "denylisted language is refused"). |
| 1.2 Report content and users | Pass | Message long-press, chat header, review flag and now the barber profile (R3). `user_reports` target types cover user, message and review. |
| 1.2 Block users | Pass | `user_blocks`: blocks new messages and bookings, hides the barber (matrix 70-74). |
| 1.2 Published contact information | Pass | `privelier@outlook.com` in customer Account > Help and barber Settings and Verify (`AccountSectionScreen.tsx:29`, `BarberSettingsScreen.tsx:51`). |
| 1.2 Founder workflow incl. removing a "permanent" review | Pass with a human step | D24: reviewed within 24 h; warn, then suspend, then remove. Reports go to `public.user_reports` with push alerts to `private.safety_staff` (migration 0061). Removing a review: `delete from public.reviews where id = '<id>';` in the SQL editor (postgres role). The average recomputes (migration 0070, R20). The second founder still needs a device registered for alerts (F18). |
| 1.2 Terms accepted before posting | **Fail → Human** | A consent gate exists (versioned `accept_current_legal_consent`), but the text is a placeholder without the zero-tolerance clause (R1). |
| 5.1.1(i) Privacy policy link in app and metadata | **Fail → Human** | The in-app link exists (`LegalLinks`). No published URL (R1). |
| 5.1.1(v) In-app account deletion, full record, states retention | Pass | `DeleteAccountAction` (typed confirmation) → `delete-account` Edge Function → `delete_own_account()`. It deletes the auth user, private rows and storage, anonymizes shared history (D7), and states what is retained (R9). Tested in `abuse_limits_and_account_deletion.test.sql` (35 assertions). |
| App Privacy labels | Needs human action | Answers drafted field by field in `docs/release/store-privacy-forms.md`. Re-checked against the code: name, email, phone, address, precise and coarse location, photos, messages, other UGC, user ID, push token. No tracking, analytics or crash SDK. Enter them in App Store Connect (F22). |
| Permissions: specific purpose strings, asked at point of use, denial handled | Pass | Location is asked in `startTrip` only, with `permission_denied` handled (`tripService.ts:326-327`). The photos string is specific. Camera and microphone are disabled. The generic Face ID string is removed (R8). Calendar uses `createEventInCalendarAsync` (system sheet). |
| Privacy manifest | Pass (verify on archive) | `expo.ios.privacyManifests` declares UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1 and DiskSpace E174.1. Pods ship their own. Check the Xcode privacy report on the first archive. |
| Xcode 26 / iOS 26 SDK | Needs human action | `eas.json` pins no image. Confirm the EAS build log shows Xcode 26 for SDK 58. |
| `supportsTablet` | Pass | Now `false` (R7). |
| OTA updates (2.5.2) | N/A | `expo-updates` is not installed. |
| 4.8 Sign in with Apple when Google is offered | Pass | Enforced in code: Google never shows on iOS without Apple (R2). |
| 3.1 payments | N/A | No payments are built. Re-check 3.1.3(e) when Stripe is added: physical services may use external payment. |
| 2.5.4 background location | Needs human action | Live arrival only, with the blue indicator and no "Always" request. The review note is updated (R12). |
| Age-rating questionnaire | Needs human action | Complete it in App Store Connect. Chat between adult strangers and UGC mean answering "Unrestricted web access: no" and "User-generated content: yes". The app requires adult confirmation at signup (`adult_confirmed_at`). |

### Google Play

| Requirement | Result | Evidence / owner |
|---|---|---|
| `targetSdkVersion` 36 | Pass | Expo SDK 58 defaults `targetSdkVersion` and `compileSdkVersion` to 36 (`expo-modules-core/android/ExpoModulesCorePlugin.gradle:65,69`). No override. |
| 16 KB page size | Pass (re-check on AAB) | F24: `tools/android/check_16kb.py` verified every prebuilt native library. Run it once on the production AAB from EAS. |
| Account deletion in-app and at a public URL | **Needs human action** | In-app: Pass. Web page ready (`site/delete-account.html`, EN/DE) but not published until Pages is enabled (F19). |
| Data safety form accurate, matches iOS, with privacy URL | Needs human action | Drafted in `store-privacy-forms.md`. Blocked on the privacy URL (R1). |
| UGC: terms before posting, report, block, moderation | **Fail → Human** | Report, block and moderation pass (as for Apple). The terms text is a placeholder (R1). |
| Photos: no media or storage permissions, system picker | Pass | The merged manifest (introspect) marks `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `CAMERA` and `RECORD_AUDIO` as `tools:node="remove"`. |
| Location foreground only | Pass with declaration | `ACCESS_BACKGROUND_LOCATION` is removed. A foreground service of type location runs only during a trip. Play Console declaration: F30. |
| Account type / closed test | Needs human action | A personal developer account created after Nov 13, 2023 needs a closed test with at least 12 testers for 14 days before production. Organization accounts are exempt. Check which account type Privelier has. |

## 4. Human-action list

New items are also added to `docs/hardening/FOUNDER_ACTIONS.md` (F27-F33).


1. **Legal (blocks both stores):** publish the privacy notice, customer and barber terms (with zero-tolerance for objectionable content and abuse) and the Impressum at public URLs. Replace the drafts in `src/legal/documents`, then bump the consent versions (F20).
2. **Email:** configure custom SMTP in Supabase Auth and raise the email rate limit (F28).
3. **Auth settings:** the password minimum is now 8 (done). Decide on CAPTCHA and leaked-password protection (F11).
4. **Sign-in providers:** either keep them hidden (current default) or configure Google (OAuth client) and Apple (Services ID and key) in Supabase. Then set `EXPO_PUBLIC_OAUTH_PROVIDERS=apple,google` in EAS (F27).
5. **App Store Connect:** privacy policy URL, support URL, App Privacy answers from `store-privacy-forms.md` (F22), age rating, review notes from `docs/release/app-review-notes-*.md`, and demo accounts (one customer, one pre-approved barber with data; F21). Confirm Xcode 26 in the EAS build log.
6. **Play Console:** Data safety (F22), deletion URL after enabling Pages (F19), foreground-service location declaration with a short video (F30), app access with the demo accounts, content rating, and the closed test if it is a personal account.
7. **Looks feature:** Taha reviews, merges and tests the 20 live Looks RPCs, or revokes EXECUTE until launch (F31).
8. **Devices:** run the Maestro suite, including the two new flows, and the two-device realtime chat and booking checks on release builds of Android and iOS. Also test dark and light mode, small screens and large text (F25). Run `exiftool` on an uploaded portfolio photo (F23).
9. **Scanners:** run `osv-scanner`, and accept the gated `salve-research/salve-js-vuln-dataset` terms with a Hugging Face login so its CWE list can be added to section 5 (F32).
10. **Workstation:** reinstall Git for Windows and uv (R19).
11. **Still open from the hardening run:** F1, F3-F12, F14, F18 and F26.

## 5. Supporting material

### pgTAP results

`python tools/db/supa.py test`, every file inside `BEGIN … ROLLBACK` as the real `anon` and `authenticated` roles with JWT claims (never as service role):

`python tools/db/supa.py test --with supabase/migrations/0070_recompute_rating_on_review_delete.sql -- <all suites>`:

```
ok    abuse_limits_and_account_deletion.test.sql (35 assertions)
ok    authorization_matrix.test.sql (118 assertions)
ok    barber_dashboard_analytics_contract.sql
ok    barber_stats_job_grants_contract.sql
ok    booking_validation_contract.sql
ok    release_invariants.test.sql (56 assertions)
ok    review_removal.test.sql (6 assertions)
ok    safety_staff_alerts.test.sql (10 assertions)
ok    time_zone_and_verification_review.test.sql (21 assertions)
9/9 files passed
```

Before 0070 was applied, the same suites passed 8/9 on the live schema: `review_removal.test.sql` failed on the stale average. After applying it, plain `python tools/db/supa.py test` passes 9/9.

`python tools/db/overlap_concurrency_test.py`: A inserted, B refused (lock wait on the in-flight overlap), C inserted (11:30, after the buffer), D inserted, PASS.

Personas in `release_invariants.test.sql`: anon, customers A and B, approved barbers X and W, and pending barber Y (the goal's "unverified Z").

| # | Invariant | Denied cases | Allowed cases |
|---|---|---|---|
| 1 | Only the booked barber accepts, rejects or completes | Another barber accepts, completes or rejects (0 rows). The customer rejects or completes (P0001). A rejected booking cannot be revived. | The barber accepts, completes and rejects. |
| 2 | Only the customer cancels a pending booking | The barber cancels a pending booking (P0001). Another customer cancels (0 rows). A cancelled booking cannot return to pending. | The booking's customer cancels. (Accepted bookings may be cancelled by either participant, matching the lifecycle.) |
| 3 | Exact coordinates readable only by that barber | Another barber, a customer or anon. No `latitude`, `longitude` or `address` column in the discovery projections. | The barber reads own coordinates. |
| 4 | Customer name reaches a barber only through a shared booking | The barber reads `users` directly (0 rows). An unrelated barber gets nothing from the lookup. | `get_booking_counterparts` returns "Ada Customer" to the booked barber. |
| 5 | Reviews: completed booking, own barber, immutable | Naming another barber, the barber reviewing, reviewing a rejected booking, and the author or barber deleting or editing (42501). Matrix: not yours, not completed, rating out of range, duplicate. | The customer reviews the completed booking. |
| 6 | Service belongs to the booked barber | A direct insert pairing barber X with W's service is refused. | `create_booking` derives the barber from the service. |
| 7 | Booked price never changes | The barber or customer updates the price (42501). A table-owner write outside service_role is refused by the trigger (P0001). Matrix: a client-supplied price is refused. | A later service price change leaves the snapshot intact. |
| 8 | Verification status only via the founders' action | Self-approval, another barber, a customer calling `private.review_barber_verification`, and a barber approving own request row (42501). | The barber still edits own bio. `time_zone_and_verification_review.test.sql` proves the founders' action approves and rejects. |
| 9 | Verification docs have no public URL; portfolio public, max 6 | `verification-docs` bucket not public. Anon and another barber see no objects. A photo in another barber's portfolio is refused. The 7th photo is refused (P0001). Matrix: no listing, size and MIME allowlist. | The portfolio bucket is public. The owner sees own document. A barber adds a photo. |
| 10 | Chat, read receipts and typing: participants only | An unrelated barber reads the chat or joins the typing channel. Another customer reads the receipts. Matrix: forged sender, non-participant posts, >2000 characters, denylist, edits. | The participants write, read, store and read receipts, and join typing. |
| 11 | No service_role key in clients, bundles or history | `gitleaks git` (349 commits) and `gitleaks dir` on fresh iOS and Android exports: no leaks. The only `sb_secret_`/`service_role` bytes in the bundles are the `lib/env.ts` guard literals. `lib/env.ts` refuses to start with a secret key (`lib/__tests__/env.test.ts`). | The publishable key is present, as intended. |

### CWE coverage

Source: `dqwang122/susvibes`, loaded with `datasets` as data only (186 rows, 74 distinct CWE ids in `cwe_ids`; nothing from the dataset was executed). `salve-research/salve-js-vuln-dataset` is gated on the Hub, and loading it without authentication fails with `DatasetNotFoundError` (F32). Server-only classes are excluded as irrelevant to a TypeScript/Expo + Supabase app with no custom server: memory corruption (CWE-787, 190, 130), OS command and argument injection (78, 77, 88), XXE (611), request smuggling (444), CRLF injection (93), path traversal on a server filesystem (22, 23, 29), and unsafe file permissions (276, 732). The 25 relevant ones:

| CWE (count in susvibes) | Where it could occur in Privelier | How it was checked | Result |
|---|---|---|---|
| 79 XSS (24), 80 (5) | Web build, map iframe, legal text rendering | Semgrep p/react and p/javascript. The only `dangerouslySetInnerHTML` is gluestack's web provider, which injects its own colour-mode script with a constant mode, not user input. The map page is a sandboxed `srcDoc` | Pass |
| 770 / 400 resource exhaustion (9 / 4) | Message, booking and report floods | `private.limit_api_writes` (120/min per user, 600/min per IP), per-table caps, `abuse_limits` suite (35) | Pass |
| 200 information exposure (7) | Directory, exact location, customer names | Invariants 3 and 4; directory projection checks | Pass |
| 1333 ReDoS (6) | Client validation regexes | Semgrep (no finding). Validation regexes are anchored and simple (`lib/env.ts`, `validation.ts`) | Pass |
| 89 SQL injection (6) | RPCs and PostgREST filters | All access goes through supabase-js parameters. The catalog query for `execute` in `public` functions returns only `rls_auto_enable` (an event-trigger helper that `authenticated` cannot execute) | Pass |
| 601 open redirect (6) | Auth deep links and OAuth callback | Redirect allow list is exactly `privelier://auth-callback`. `src/auth/deepLink.ts` accepts only its own scheme | Pass |
| 863 / 284 / 639 authorization (5/1/1) | Booking transitions, reviews, IDOR on ids | Invariants 1, 2, 5 and 10; matrix (118) | Pass |
| 352 CSRF (5) | None (bearer tokens, no cookies) | Architecture | N/A |
| 347 signature verification (4) | Edge Function JWT, Apple ID token | `delete-account` verifies the JWT (unauthenticated → 401, F2). The Apple token is verified by Supabase | Pass |
| 287 / 306 authentication (4 / 2) | RPCs without auth checks | `anon can execute no public function` (matrix 113). Lint 0029 reviewed (R10 open) | Pass, R10 open |
| 20 input validation (3) | Message length, ratings, prices | Check constraints (1-2000 characters, rating 1-5, price > 0) | Pass |
| 532 sensitive data in logs (3) | Auth and trip logging | ESLint `no-console`; `devWarn` and `logAuthError` are dev-only. `.expo/dev/logs` are local and git-ignored | Pass |
| 521 / 522 weak or insecure credentials (2 / 2) | Password policy, token storage | Server minimum is now 8, matching the app (R11). The session is encrypted (AES key in SecureStore). Leaked-password protection is still off | Pass (HIBP: Human) |
| 918 SSRF (2) | `pg_net` push calls | Fixed Expo push URL inside SECURITY DEFINER triggers; no user-supplied URL | Pass |
| 203 / 209 error-message disclosure (2 / 1) | Auth errors, account enumeration | `errorCopy` maps codes to calm copy. The Auth API response is identical for unknown emails (hardening run) | Pass |
| 295 certificate validation (1) | TLS | Platform TLS. No pinning, by decision (D11) | Accepted |
| 312 / 311 cleartext storage (1 / 1) | Session, addresses | Encrypted session storage; addresses only in RLS-scoped tables | Pass |
| 330 / 331 weak randomness (1 / 1) | Idempotency keys, object names | `expo-crypto` / `gen_random_uuid()` | Pass |
| 362 race condition (1) | Double booking, six-photo cap | Exclusion constraint plus concurrency proof; cap trigger under the matrix | Pass |
| 613 session expiration (1) | Refresh tokens | Refresh-token rotation on. Sign-out clears channels and caches (hardening run) | Pass |
| 614 / 1021 cookie and clickjacking (1 / 1) | Web build only | No auth cookies. The web build is not a store deliverable | N/A |
| 425 / 269 forced browsing, privilege management (1 / 1) | Verification bucket, role escalation | Invariants 8 and 9; "customer cannot promote own role" (matrix 12) | Pass |
| 94 code injection (1) | `eval`, dynamic `require` | Semgrep. The only dynamic `require` is the `__DEV__` gallery | Pass |
| 674 / 835 uncontrolled recursion and loops (1 / 1) | Realtime reconnect, retries | No automatic retry of non-idempotent writes. Bounded backoff in the conversation hook | Pass |
| 754 / 755 / 252 unchecked errors (1 / 1 / 1) | Data layer | ESLint `no-floating-promises`. Every data function returns a status union | Pass |

## Method and limits

- **Database tests ran on the production project inside transactions that never commit.** No Docker (so no `supabase start`) and no paid branch were available. This is the established project practice (`tools/db/supa.py`, `docs/hardening/README.md`). At founder request, two live changes followed the audit: migration 0070 was applied, and the Auth password minimum was raised to 8. Nothing else live was changed.
- **Live Auth settings** were read through the Management API with only non-secret fields printed.
- **Not performed:** release builds and Maestro runs on devices, iPad and screen-size checks, cold-start timing, and network-failure runs on hardware. iOS builds need macOS or EAS. A local Android `bundleRelease` failed in `react-native-worklets`' CMake step. The Windows 260-character path limit blocked it (`ninja: error: mkdir(…/Common/cpp/worklets/SharedItems/Serializable): No such file or directory`). The cause is the workstation, not the code: EAS builds on Linux and macOS. To build locally, enable Windows long paths or build from a short `subst` drive.
