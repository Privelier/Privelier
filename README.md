# Privelier

Privelier is a premium, private marketplace for customers to book independent barbers at their own location. It is one Expo/React Native codebase with two separate experiences and navigation trees: Customer and Barber. Both use one Supabase project for Auth, Postgres, Storage, Realtime, and Row Level Security.

## Prerequisites

- Node.js 20 LTS or later and npm
- An Expo development build for native-only features (Secure Store, image picker, and Mapbox)
- Access to the project Supabase instance

Copy `.env.example` to `.env` and set the public runtime values. The file is gitignored.

```powershell
Copy-Item .env.example .env
npm ci
```

Never put a Supabase `service_role` key, Mapbox secret download token, provider secret, or private key in `.env`, Expo config, or client code. `EXPO_PUBLIC_*` values are embedded in the client: use only the Supabase anon key and a Mapbox public `pk.` token there. The Mapbox download token belongs only in EAS secrets (`RNMAPBOX_DOWNLOAD_TOKEN` or `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`).

## Run and validate

```powershell
npm start
npm run android
npm run ios
npm run web
npm run lint
npm run typecheck
npm test -- --runInBand
npx expo-doctor
```

For the intended native preview, install a compatible development build on a physical device, run `npm start -- --dev-client`, then open the displayed Expo link. `npm run web` is useful for a quick navigation/UI preview, but it cannot validate native image selection, Secure Store, or the Mapbox native module.

## Architecture

- `src/customer/` — customer discovery, booking, inbox, chat, reviews, and account UI.
- `src/barber/` — barber studio, requests, services, availability, portfolio, chat, and verification UI.
- `src/shared/` — cross-app, role-neutral utilities and components only.
- `lib/supabase.ts` — the client-side Supabase anon-key client.
- `supabase/migrations/` — forward-only schema, RLS, storage, and integrity migrations.
- `docs/design/` — approved feature decisions. Read the matching design before changing a governed feature.

Do not merge the customer and barber navigators into a generic shared experience. Database rules, not UI checks, own authorization, booking state transitions, review eligibility, and verification protections.

## Database and migrations

Do not edit an applied migration. Schema changes require the repository’s schema-architect process, a new migration, live verification through Supabase, and the security gate. Keep booking state transitions exactly as documented in `AGENTS.md`; do not weaken RLS, grants, triggers, storage policies, or privacy boundaries to unblock UI work.

The current release blocker is server-side appointment validation: the client derives valid slots, but the database still permits raw-API bookings outside availability and overlapping variable-duration bookings. Resolve it through a dedicated booking/schema pipeline before release.

## Testing and release gates

Unit and component tests run in Jest. Authored Maestro flows live in `.maestro/`; see its README for seeded-account requirements and commands. They require a real Android/iOS development build and have not all been executed on this machine.

Release also requires founder-controlled validation that cannot be faked locally: two-session Realtime booking/chat behavior and recovery, image selection, Secure Store, Mapbox, manual verification review, social OAuth provider configuration, iOS development build, and the end-to-end real-user flow.

## Scope and security

This MVP uses only Expo/React Native and Supabase. Payments, automated KYC/biometrics, push notifications, subscriptions, AI recommendations, and multi-country payment logic are not in scope. Verification is manual: ID and license images remain private Supabase Storage objects and founders review them in Supabase.
