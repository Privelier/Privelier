# Discover content design

## Scope

Improve the customer Discover tab with only real, already-authorized data. This is a client/UI feature: no schema, RLS, Storage, location, availability, or booking-state change.

## Information architecture

1. Keep the greeting and show the signed-in user's city and optional country as quiet service-area context.
2. Keep search and service filters, sourced only from the approved directory and its services.
3. Show one neutral `Barber spotlight` card when no search/filter is active.
4. Show the remaining results under `Verified barbers in {city}`.
5. Remove unsupported distance, proximity, availability, recommendation, and editorial claims. Remove stock style imagery; profile images remain real barber content.

## Spotlight rule

The directory is already approved-only by the `barber_directory` view. A deterministic daily spotlight provides fair exposure without pretending to be a recommendation:

- Prefer rows with a profile image and at least one successfully loaded service.
- Fall back to all currently filtered rows.
- Sort qualifying IDs lexically, then select UTC epoch-day modulo count.
- Keep all non-spotlight rows in the existing alphabetical directory order.
- Hide the spotlight composition once a search or service filter is active; show the filtered directory only.

Ratings remain factual display data, never a ranking claim. We do not have review-count data, so a rating-first feature would be misleading at MVP scale.

## Failure behavior

The directory remains primary. If service enrichment fails, barbers still render and name search stays available; service chips, service-price copy, and service-name search disappear rather than implying no services exist. Directory/profile failures preserve existing retry states.

## Validation and security

- Unit-test the spotlight selector, filters, service-chip derivation, and enrichment-failure path.
- Add screen tests for truthful copy, no duplicate spotlight/rail row, filtering, navigation, loading, empty, and retry states.
- Preserve current navigation and Maestro test IDs; adapt E2E selection so it is independent of the rotating spotlight.
- Test dark/light, large text, keyboard, and screen-reader labels on development builds.
- Security review confirms only authenticated `barber_directory`/`services` reads, no exact coordinates or verification data, no external stock images, and no `service_role` in client code.

## Location-policy update — 2026-09-21

Founder Taha opened the app to all locations, superseding the 2026-09-20
Nuremberg-only gate. Discovery uses the customer's manually entered city. It
trims and compares city values case-insensitively, including stored values with
surrounding whitespace, while keeping aliases such as `Nuremberg` and
`Nürnberg` distinct. Distance-based discovery from the existing public barber
coordinates is deferred to its own pipeline.
