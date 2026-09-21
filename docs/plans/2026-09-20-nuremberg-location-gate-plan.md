# Nuremberg location gate

> **Superseded on 2026-09-21 by founder decision from Taha.** The app is open
> to all locations. Location permission is not required for signup, login,
> OAuth, app entry, or foreground use. Manual city capture is restored. The
> scope, decisions, architecture, and acceptance checks below are historical
> and must not be reintroduced.

## Replacement implementation

The root, signup, login, OAuth, setup, and foreground recheck gates were
removed. `expo-location` and its native configuration were removed. Signup and
OAuth completion now collect a required city and optional country, and users
can edit both fields later. Discovery compares city values after trimming and
case-folding; it deliberately does not treat aliases such as `Nuremberg` and
`Nürnberg` as equivalent. No database migration or existing-user rewrite was
performed.

## Scope

Replace manually entered city and country during onboarding with a current-device location gate for both customer and barber accounts. Privelier is available only when the device is currently in Nuremberg, Germany. The gate also runs after sign-in so an existing user who arrives in Nuremberg can use the app without changing profile data manually.

## Decisions

- Request foreground location only. The operating system owns the Allow Once, While Using, and Don't Allow choices; the app must not request background location.
- Denied, unavailable, inaccurate, or outside-service-area location blocks onboarding and authenticated app access with an honest recovery state.
- The app persists only the derived `city = 'Nuremberg'` and `country = 'Germany'` for an eligible user. It does not persist onboarding coordinates or continuous location history.
- Eligibility requires Germany plus Nuremberg from native reverse geocoding. City spelling is normalized only for `Nuremberg` and `Nuernberg`; a location in a surrounding municipality is unavailable until founders define a wider service area.
- Existing profiles remain readable. Their next authenticated session must pass the current-device gate before customer or barber navigation is shown.

## Architecture review

No schema change is required: `users.city` and `users.country` already hold the derived values. No new backend service is introduced. Expo Location is a client-side native module that delegates the permission prompt to iOS/Android. The location result must stay outside user metadata and logs. The auth root state needs a new pre-navigation eligibility phase, which cannot make a role decision and must fail closed when permission or location lookup fails.

The service boundary is: permission request -> one foreground coordinate -> reverse geocode -> normalized availability result. Screens render the result; auth provisioning writes only the normalized city/country after an eligible result. This keeps a forged client city field from bypassing the UI, but it is not a server-side anti-spoof guarantee. A real entitlement guarantee would require founder-approved service-area enforcement at the database/API layer, which is outside this UI-location feature and needs schema-owner review.

## Build progress

The SDK 57-compatible `expo-location` dependency and foreground-only iOS permission copy are installed. `src/location/locationEligibility.ts` now owns the fail-closed eligibility contract, and `src/location/nativeLocationGateway.ts` obtains one current fix, rejects inaccurate readings before reverse geocoding, then immediately reduces an eligible result to `Nuremberg`/`Germany`. The service is covered by nine unit tests. It is deliberately not yet wired into signup or authenticated navigation: that visual/root-state work must be completed as its dedicated mobile/UI stage, with native iOS and Android evidence after a new development build.

## Acceptance checks

- Both signup paths request foreground location before profile provisioning.
- No country field is presented during signup or OAuth completion.
- Eligible results save exactly Nuremberg/Germany; no raw coordinates are written to `users`.
- Denied, unavailable, and outside-Nuremberg outcomes prevent entry and offer retry/settings recovery.
- Existing signed-in users are rechecked before customer/barber navigation.
- Unit tests cover normalization, denied/unavailable/outside outcomes, and no-coordinate persistence; native iOS/Android checks verify each permission choice.
- Security review confirms no background-location permission, raw coordinate persistence, or service-role leak.
