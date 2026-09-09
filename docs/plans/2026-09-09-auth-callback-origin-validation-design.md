# Auth callback origin validation design

Status: approved for implementation in this workspace on 2026-09-09

## Scope

This is one security-hardening feature for RISK-028. It covers the existing
email-confirmation callback handled by `src/auth/deepLink.ts`. It does not add
OAuth providers, change Supabase configuration, alter navigation linking, or
change the database schema.

## Recommended approach

Validate the URL authority before parsing its fragment. The accepted callback
is the native-build URL produced by the current app configuration:

```text
privelier://auth-callback
```

The validator accepts the `privelier` scheme, the `auth-callback` hostname,
and an empty root path. Query parameters remain allowed because Supabase or a
future callback handoff may add non-secret metadata there; credentials are
still read only from the fragment. The validator rejects other schemes,
hostnames, paths, malformed URLs, and user-info/host-spoofing forms. It does
not log the incoming URL or token values.

`parseAuthCallbackUrl` will return `null` for a non-callback URL, so every
current and future caller receives the same origin boundary. The handler keeps
its existing behavior for valid callback fragments: expired links return
`expired_or_used`, malformed token pairs return `error`, and a successful
Supabase `setSession` returns `applied`.

## Validation and security gates

- Unit coverage proves the expected callback is accepted and valid token
  fragments delivered through wrong schemes, hosts, paths, user-info, and
  malformed URLs never call `supabase.auth.setSession`.
- Existing callback success, expiry, malformed-fragment, and error mapping
  tests remain green.
- TypeScript, ESLint, and the full Jest suite must pass.
- The final security review checks that no callback URL or token is logged and
  that no `service_role` credential exists in client code or Git history.
- A physical native deep-link smoke test remains external: an expected email
  confirmation callback must still establish a session on the Android/iOS
  development build, while an unexpected path must be ignored.

## Integration boundary

No imports or route contracts change outside `src/auth/deepLink.ts` and its
focused test. `useAuthShell` continues to call `applyAuthCallbackUrl` for cold
start and running-app URL events, and the existing `privelier` app scheme in
`app.json` remains the source of the registered native scheme.
