# Privelier

Privelier is a marketplace for booking independent barbers who travel to the customer. It is one Expo / React Native codebase with two separate experiences and navigation trees, Customer and Barber, on one Supabase project (Auth, Postgres, Storage, Realtime, Row Level Security).

## Prerequisites

- Node.js 20 LTS or later and npm
- An Expo development build for native-only features (Secure Store, the photo picker, native MapLibre maps, background trip location and push). Expo Go shows maps through the MapLibre GL web renderer.
- Access to the Supabase project
- Python 3.11 or later for the database and geo tooling in `tools/`

Copy `.env.example` to `.env` and fill in the two public values. The file is gitignored.

```powershell
Copy-Item .env.example .env
npm ci
```

`EXPO_PUBLIC_*` values are compiled into the app in plain text. Only the project URL and the publishable key (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `sb_publishable_...`) belong there; `lib/env.ts` refuses to start with a secret or `service_role` key. Maps (MapLibre and OpenFreeMap), address search (Photon) and routing (FOSSGIS OSRM/Valhalla) need no keys; see `tools/geo/README.md`.

## Run

```powershell
npm start            # Expo dev server
npm run android      # build and install the development build (expo run:android)
npm run ios          # same for iOS (expo run:ios, macOS only)
npm run web
```

For a native preview, install a development build on a device, run `npm start -- --dev-client` and open the Expo link. The web build is useful for navigation and layout only.

## Check

```powershell
npm run check        # typecheck, lint (zero warnings), tests, knip, duplication, circular imports
npm run db:test      # pgTAP suites against the project, inside transactions that never commit
npx expo-doctor
```

`docs/hardening/README.md` lists every check, including the database tools, the concurrency test and the secret scan. CI (`.github/workflows/quality.yml`) runs the same gate on every push and pull request. Run `bash tools/hooks/install-gitleaks-hook.sh` once per clone to scan staged changes for secrets.

## Architecture

- `src/customer/`: discovery, booking, inbox, chat, reviews and account.
- `src/barber/`: studio, requests, services, availability, portfolio, chat, verification and live trips.
- `src/shared/`: role-neutral components, hooks and utilities only. Customer and barber code cannot import each other (lint-enforced).
- `src/database.types.ts`: generated from the live schema (`npm run db:types`); the Supabase client is typed with it.
- `lib/supabase.ts`: the client, created with the publishable key.
- `supabase/migrations/`: forward-only schema, RLS, storage and integrity migrations.
- `supabase/tests/`: pgTAP suites, including the authorization matrix.
- `supabase/functions/delete-account/`: the only Edge Function; it holds the secret key server-side.
- `docs/design/`: approved feature decisions. Read the matching design before changing a governed feature.

The database, not the UI, owns authorization, booking state transitions, review eligibility, verification protection, rate limits and the overlap rule. Do not weaken RLS, grants, triggers or storage policies to unblock UI work.

## Database and migrations

Never edit an applied migration; add a new one. Dry-run it (`python tools/db/supa.py dry-run`), cover it with a pgTAP test, and apply it only with founder authorization. Booking status transitions follow `AGENTS.md` exactly.

## Release

Release gates that need founders or devices are listed in `docs/hardening/FOUNDER_ACTIONS.md` and `AGENTS.md` (Step 18): two-device Realtime booking and chat, Maestro flows (`.maestro/`), native builds, store forms and the legacy key switch-off. Store material is in `docs/release/`.

## Scope

Expo / React Native and Supabase only. Push notifications (Expo push) and live arrival tracking are in scope by founder decision (2026-10-25). Payments, subscriptions, automated KYC or biometrics, AI recommendations and multi-currency are not. Verification is manual: ID and licence photos stay in a private bucket and the founders review them in Supabase.
