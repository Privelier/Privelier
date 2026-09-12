# Release readiness - 2026-09-12

## Completed

- Booking validation migrations `0024` through `0028` are applied live. The focused contract passes: required duration snapshot, duration check, and validation trigger are present.
- The booking validator enforces future appointments, active availability windows, variable-duration overlap protection, and serialized same-barber/day writes.
- Waitlist migrations `0029` and `0030` are applied live. `public.waitlist` remains retained, has authenticated-admin SELECT only, and has no anonymous/authenticated INSERT, UPDATE, or DELETE access. The Supabase no-policy advisor finding is cleared.
- Expo SDK 57 patch dependencies are aligned. `expo-doctor` passes 21/21.
- `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, and `npx expo export --platform web` pass. Jest result: 48 suites, 566 tests.

## Still blocked or founder-owned

- Native Maestro/device flow: Maestro 2.10.0 is installed, but `adb devices` reports zero devices. The real-user flow, two-session Realtime check, image picker, Secure Store, native Mapbox, and iOS build checks therefore remain blocked_external.
- Founder visual review remains required across Customer and Barber surfaces, booking, and reviews. This is a human release gate and is not replaced by web export or unit tests.
- Final security scope still has the previously accepted `barber_directory` SECURITY DEFINER view, five intended SECURITY DEFINER RPC warnings, three mutable search-path warnings, and leaked-password protection warning. No new waitlist finding remains.
