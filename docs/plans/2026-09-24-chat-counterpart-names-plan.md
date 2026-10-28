# Chat counterpart names plan

## Scope and acceptance

For both Customer Inbox and Barber Chats, make the other participant's real name the primary thread identity. Keep the booked service as secondary context and keep the latest-message preview visible. Apply the same name-first hierarchy to both conversation headers. If identity enrichment is unavailable or blank, use the role-specific `Barber` or `Customer` fallback without failing chat.

No schema, RLS, dependency, navigation, or message-delivery contract changes are in scope.

## Plan and design

Observed before implementation:

- Customer threads depended on `barber_directory`, whose approved-barber purpose is narrower than participant chat identity.
- Barber threads had no list-side counterpart identity and led with the service.
- Only the Barber conversation header performed a one-booking counterpart lookup.
- Migration 0012 already provides the required participant-scoped projection: booking id, counterpart id, name, and profile image.

Three approaches were considered:

1. Keep the mixed sources and add only the missing Barber lookup. This leaves the two apps inconsistent and keeps Customer chat coupled to discovery approval.
2. Use the 0012 RPC for both role apps, batch list enrichment by booking, and refresh each open header best-effort. This is the selected approach because it gives both apps one authorization contract without widening `users` reads.
3. Add an app-wide identity cache. This adds account-switch invalidation and stale-name risks for a small read path, so it is deferred.

The shared helper deduplicates requested booking ids, accepts only returned rows belonging to that request, trims names, rejects blank names, and contains returned or thrown failures as an empty result. It keeps no cross-session cache. Each `InboxThread` carries a best-effort `counterpart` keyed by booking id.

Thread layout remains flat and calm: counterpart name in the existing serif primary line, service in smaller muted type after a middle dot, and the real latest-message preview on its own line. Existing dates, unread state, press feedback, avatars, list virtualization, navigation, and test IDs remain intact. New stable IDs identify the name, service, preview, and header text for regression coverage. Accessibility labels announce the counterpart and service when present.

## Build and handoff

Implementation is limited to the shared counterpart projection/helper, both chat-list data loaders, both list screens, both conversation headers, focused tests, and explanatory navigation comments. The existing RPC remains the sole cross-user identity source; direct `users` RLS and all migrations remain unchanged.

Validation, security verdict, integration evidence, and commit details are recorded by the item-level pipeline after the build is stable.
