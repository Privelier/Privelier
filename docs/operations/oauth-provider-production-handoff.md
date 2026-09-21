# OAuth provider production handoff

## Why Expo Go cannot validate this flow

Privelier uses PKCE and redirects authenticated sessions to
`privelier://auth-callback`. Expo Go does not register Privelier's custom URL
scheme, so Safari can consume or open a callback outside the app's PKCE
session. Test email recovery and OAuth only from an iOS or Android development
build with the Privelier app installed.

## Fixed redirect values

Use these exact values. They are identifiers, not credentials.

| Where | Value |
| --- | --- |
| Supabase Authentication > URL Configuration > Redirect URLs | `privelier://auth-callback` |
| Google Cloud authorized redirect URI | `https://ajcsanrepboqcjgpzsaa.supabase.co/auth/v1/callback` |
| Apple Services ID domain | `ajcsanrepboqcjgpzsaa.supabase.co` |
| Apple Services ID return URL | `https://ajcsanrepboqcjgpzsaa.supabase.co/auth/v1/callback` |
| iOS bundle identifier | `com.privelier.app` |

Do not register the custom `privelier://` URL with Google or Apple. They return
to Supabase over HTTPS; Supabase then returns the app to its allow-listed
custom scheme.

## Google

1. In Google Cloud Console, configure the OAuth consent screen with the real
   Privelier support/privacy links before moving it beyond testing.
2. Create a Web application OAuth client and add the Google callback URI from
   the table above as an authorized redirect URI.
3. Keep the app in testing and add real test accounts until the consent screen
   is verified, or complete the production verification process if required by
   the requested scopes.
4. In Supabase Dashboard > Authentication > Providers > Google, enable the
   provider and enter that Web client ID and client secret.

## Apple

1. In Apple Developer > Certificates, Identifiers & Profiles, enable Sign in
   with Apple for the App ID `com.privelier.app`.
2. Create a Services ID for the Supabase browser authorization flow; associate
   it with the primary App ID, its domain, and the return URL from the table.
3. Create a Sign in with Apple private key. In Supabase Dashboard >
   Authentication > Providers > Apple, enable Apple and enter the Services ID,
   Team ID, Key ID, and private key.
4. Register the sender domain used for Privelier's production SMTP with
   Apple's Private Email Relay when supporting Hide My Email addresses.

## Validation gate

From an installed development build, test Google and Apple signup/login for a
customer and a barber. Confirm callback completion, manual city/country setup,
profile provisioning without a location-permission prompt, manual barber
verification remaining pending, a second login, cancellation, and
provider-denied/error states. Test password recovery with a fresh email link
only once; recovery tokens are intentionally one-time.

Never commit Google client secrets, Apple private keys, Team IDs, SMTP
passwords, or any Supabase secret/service-role key. Keep them only in the
provider consoles and Supabase Dashboard.

## Sources

- Supabase mobile social auth: <https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth>
- Supabase redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
- Apple Services ID setup: <https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web>
