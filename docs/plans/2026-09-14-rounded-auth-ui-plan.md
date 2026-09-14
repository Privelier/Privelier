# Rounded auth UI plan

## Scope

Upgrade the shared pre-auth and provisioning UI while preserving existing auth behavior, navigation routes, validation, and test IDs.

## Design

- Keep the existing Privelier dark-first palette, editorial headings, and calm copy.
- Use surface-backed fields with a hairline border, generous 52px target, and rounded corners.
- Use pill-shaped primary and secondary buttons.
- Use rounded role cards, role selectors, notices, and circular back controls.
- Preserve keyboard avoidance, focus chaining, inline errors, loading states, and screen-reader labels.
- Add Google and Apple provider actions that open Supabase's hosted OAuth flow and return through the existing `privelier://auth-callback` listener.

## Build order

1. Centralize geometry changes in the shared auth UI primitives.
2. Apply the same radius tokens to role selection and provisioning controls.
3. Run typecheck, lint, and focused auth tests.
4. Refresh the context graph and inspect the final diff for square auth surfaces.

## Acceptance criteria

- No auth control or auth surface has a sharp corner.
- Existing auth test IDs and navigation behavior remain unchanged.
- Required fields, password visibility, loading, and error states remain accessible.
- No dependencies, schema, backend contracts, or secrets change.
- Provider availability still depends on enabling Google and Apple in Supabase Auth and registering the callback URL in each provider dashboard.
