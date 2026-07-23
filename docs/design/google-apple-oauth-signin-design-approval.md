# Design gate — Google + Apple sign-in

**Stage:** Design (architect-review), applied manually per this project's standing gap (`architect-review` is not a spawnable subagent_type — see CLAUDE.md Cross-cutting hygiene). Input: `task-decomposition-expert`'s WBS (2026-07-23, 7 objectives / 35 tasks), grounded against the live `src/auth/` code and `barber_profile`/`verification_requests` schema.

**Scope of this gate:** resolve WBS Objective 1's five open Design tasks (1.1–1.5). Nothing here is code; it is the decision record Build consumes next.

---

## Architectural Impact: **Medium**

Additive to an existing, well-isolated subsystem (`src/auth/`) with a session-driven, provider-agnostic provisioning core. No schema change. No new write path to `barber_profile`/`verification_requests`. The complexity is concentrated in the OAuth *redirect handling*, not in the provisioning/verification logic, which was already correctly designed for this before this feature was conceived.

---

## Pattern Compliance

| Pattern | Status | Note |
|---|---|---|
| Session-driven routing (`useAuthShell`) stays the single source of navigation truth | ✅ PASS | OAuth produces a session like any other sign-in; `onAuthStateChange` doesn't know or care how |
| `ensureProfile`/`provisionForSession` is the *only* path to `public.users`/`barber_profile` inserts | ✅ PASS | Confirmed unchanged by every candidate design below (Task 1.5) |
| `ProfilePrefill` is "a recovery-prefill hint only, never authorization" (existing doc comment, `src/auth/types.ts:55-58`) | ✅ PASS, and this gate leans on it directly | The OAuth role-selection design (1.1) is a direct application of this existing principle, not a new one |
| Deep-link auth callback handling (`deepLink.ts`) is the established mechanism for "app receives a session from outside the app" | ⚠️ EXTEND, not reuse verbatim | See 1.2 — the PKCE code-exchange shape is a genuinely new branch, not a drop-in reuse |
| No new schema/RLS surface | ✅ PASS | Zero schema change across every option considered |
| Shared auth UI kit (`src/auth/screens/ui.tsx`) composed from, not duplicated | ✅ Applies going into Build | `PrimaryButton`, `SecondaryButton`, `Notice` already exist; new OAuth buttons compose from these, per this project's established shared-primitive discipline |

---

## Violations

None found against the existing architecture. The one thing to flag as a near-miss: the WBS's Task 3.3 framing ("Confirm/extend `deepLink.ts`... verify PKCE is genuinely engaged") slightly undersold the actual scope of that task — see 1.2 below. Not a violation, a scoping correction for Build.

---

## Recommendations (the five Design decisions)

### 1.1 — Button placement / role-selection timing: **AuthEntryScreen, with no role-carrier across the OAuth hop**

Buttons live on `AuthEntryScreen` (role already known from the route param — `role='customer'|'barber'`), so the screen keeps its role-appropriate copy ("Barber account: manage your services..." vs "Customer account: book a barber...") for the OAuth taps too, not just email signup.

**But do not build a mechanism to carry that pre-tap role across the OAuth round-trip.** Reasoning: a web-redirect OAuth flow backgrounds the app into an external browser tab and returns via a deep link — the app's in-memory/navigation-param state is not reliably guaranteed to survive that hop (most acutely on Android, where the OS may reclaim the JS context during the browser interstitial). Building a carrier (e.g. encoding `role` into the `redirectTo` URL's query string, extending `deepLink.ts` to parse it back out) is *possible* but is new, untested surface area solving a problem that already has a correct, existing answer: **`FinishSetupScreen` already asks role, for exactly this reason** — it's the established fallback for "session exists, metadata didn't supply what we need." For OAuth, this isn't a fallback path, it's the *only* path (Google/Apple metadata never carries `role` — no identity provider has a concept of "customer vs barber" for this app), so it fires on every OAuth signup, not as an edge case.

Net effect: an OAuth-signing-up user re-confirms their role once on `FinishSetupScreen`, identically to today's existing metadata-missing fallback UX. Zero new state-carrying code. If conversion data ever shows this extra tap matters, the redirect-URL carrier is a well-understood, addable enhancement later — not built now, avoiding speculative complexity for an unmeasured problem (consistent with this project's established discipline, e.g. the Ultra design pass repeatedly declining premature extraction for single-consumer cases).

### 1.2 — Google integration approach: **`signInWithOAuth` (web-redirect) + `expo-web-browser`, not the native Google Sign-In SDK**

Recommended over `@react-native-google-signin/google-signin` + `signInWithIdToken` for three reasons: (a) it extends `deepLink.ts`, an already-proven, already-tested mechanism, rather than introducing a wholly separate credential-exchange code path; (b) it avoids a new heavy native dependency and its own per-platform client-ID setup on top of what's needed anyway; (c) Apple's flow is native regardless (compliance-mandated), so there's no "consistency between the two providers" argument for going native on Google too.

**Real correction to the WBS's framing, for Build to know going in:** `deepLink.ts` is *extended*, not reused verbatim. Supabase's OAuth flow (correctly configured for PKCE — the recommended flow for a public mobile client that can't hold a secret) redirects back with a `?code=...` query parameter requiring an explicit `supabase.auth.exchangeCodeForSession(code)` call. This is a **different shape** from `deepLink.ts`'s existing `#access_token=...&refresh_token=...` fragment handler (`parseAuthCallbackUrl`/`applyAuthCallbackUrl`), which is the *implicit-flow* shape Supabase's email-confirmation link already uses. Build needs a second, clearly-named function for the `?code=` shape alongside the existing fragment parser — not a modification that conflates the two. Confirm `flowType: 'pkce'` is explicit in the Supabase client config (`lib/supabase.ts`) rather than relying on whatever the pinned `supabase-js` version defaults to.

### 1.3 — Provider-metadata mapping (incl. Apple's first-authorization-only-name quirk): **no new mechanism needed**

Apple returns the user's name only on the very first authorization ever (a deliberate Apple privacy behavior, not a bug) — a retried/interrupted first signup could reach `FinishSetupScreen` with no name in the second attempt's metadata. This is already handled correctly by the existing architecture: `ProfilePrefill.name` is optional, and `FinishSetupScreen`'s `requiredText(name, ...)` validation already requires the user to type it if absent. **Do not build recovery logic to work around this** — Apple deliberately won't return the name again, and the existing degrade path (ask the user) is the correct behavior, not a gap. Build only needs the metadata-key mapping itself (Google's `full_name`/`picture`, Apple's `given_name`/`family_name` shapes → this app's own `name` field), which is a one-time `parseMetadata` extension, not a design change.

### 1.4 — Persist which provider was used: **no**

`session.user.app_metadata`/`auth.identities` already tracks this server-side. No `public.users` column is justified for a UX nicety with no stated current need (e.g. "you signed up with Google" messaging) — if that need materializes later, it reads from the existing session object at runtime, zero schema change.

### 1.5 — Non-bypass sign-off: **CONFIRMED**

Traced the full path for every option above: OAuth session → `ensureProfile()` → `parseMetadata` finds no usable `role` (by design, per 1.1) → `needs_setup_form` → `FinishSetupScreen` (role asked fresh) → `ensureProfileFromForm(fields)` → `provisionForSession(session, formFields)`. This is the **exact same function**, with the **exact same insert shape** (`{id, email, name, role, city, country, phone}` for `users`; `{user_id, bio}` for `barber_profile`), that email signup's existing fallback path already uses today. No candidate design in this gate creates a new write path to `barber_profile` or `verification_requests` — `ensureBarberProfileRow` still never writes `rating`/`verified`/`verification_status` (server defaults + the migration-0005 trigger, unchanged), and migration 0023's reviewer-column freeze is untouched by any of this. **The verification-required-regardless-of-signup-method guarantee holds under every design decided here, with zero new risk.**

---

## Long-Term Implications

- The `deepLink.ts` split (implicit-flow fragment handler vs. PKCE code-exchange handler) is a natural seam — if a third redirect-based flow is ever added later (e.g. a password-reset deep link), it should compose from the same two primitives rather than growing a third parser.
- Declining the role-carrier mechanism (1.1) keeps the auth surface's state model simple: session existence is the only thing that drives routing, full stop. This is worth preserving deliberately — the moment any screen starts threading its own transient state through an external redirect, `useAuthShell`'s clean "provisioning is just session + role" model gets harder to reason about.
- No maintenance burden added to the schema/RLS side. This feature's entire long-term cost lives in `src/auth/` and two new native buttons — a good sign for a two-person team's ongoing maintenance load.

---

## Next stage

Design gate: **PASSED**. Route to `supabase-schema-architect` for the formal "no schema change required" confirmation (Task 2.1 — expected to be a quick, low-effort sign-off given this gate found zero schema impact across every option), then Build (`fullstack-developer` for the data layer per 1.1–1.3, `mobile-developer` for the native/EAS work, `ui-ux-designer` for the button treatment).
