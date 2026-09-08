# Splash configuration migration design

Date: 2026-09-08
Portfolio: P01-C1
Status: approved for config-only implementation

## Purpose

Replace Expo's obsolete top-level `splash` configuration with the supported Expo SDK 57 `expo-splash-screen` config plugin without changing the startup experience or application behavior.

## Visual direction

Preserve the existing restrained Privelier launch treatment:

- background: `#121214`
- image: `./assets/splash-icon.png`
- image container width: `200`
- resize mode: `contain`
- no copy, animation, gradient, new artwork, or theme-specific variant

The source is a 512×512 opaque `#121214` image whose visible seal occupies 308×308 pixels. A 200-point image container therefore produces an approximately 120-point visible seal: identifiable, centered, and appropriately quiet for the premium brand.

## Implementation boundary

Only `app.json` may change. Remove `expo.splash` and replace the existing `"expo-splash-screen"` plugin string with exactly one configured plugin tuple. Keep the existing `App.tsx` global `preventAutoHideAsync()` call and font/auth-restoration hide behavior unchanged. Do not change assets, dependencies, screens, navigation, backend, database, authentication, or secrets.

`app.config.js` must continue to preserve the tuple when it spreads `config.plugins` and conditionally appends Mapbox.

## Acceptance

- Resolved Expo config contains exactly one splash plugin with the approved options.
- `npx expo install --check` and Expo Doctor pass.
- Lint, typecheck, serial and seven-worker Jest, and web export pass.
- Security review confirms a one-file config change and no credential/backend effect.
- Fresh Android and iOS release builds must later prove a centered, crisp, uncropped seal; `#121214` from first frame; no white flash; correct hold through font/auth restoration; and successful hide for signed-out/restored sessions. Until that physical-device evidence exists, the visual release gate remains `blocked_external`.
