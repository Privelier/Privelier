# Production authentication email handoff

## Live verification: 2026-09-20

Read-only Supabase Auth logs confirm the reported recovery behavior: a recovery email was accepted by Auth and its first `/verify` redirect succeeded, while subsequent opens of that same one-time link returned `403: Email link is invalid or has expired` with `One-time token not found`. This is normal one-time-token behavior, not a database failure. In Expo Go, a first click can still consume the token before the app can receive Privelier's custom callback; the app now prevents new email/OAuth flows from using Expo Go and directs users to a development build instead.

The same live logs confirm mail is currently sent by Supabase's default `noreply@mail.app.supabase.io` sender. No customer email address, token, IP address, or account identifier is retained in this record.

## Decision

Do not ship Supabase's default mailer. The live project was inspected on 2026-09-20 and custom SMTP is not configured, so it uses Supabase's default templates and sender. That mailer is development-only, sends as Supabase, delivers only to authorized project-team addresses, and is limited to two messages per hour.

Use a founder-owned transactional SMTP provider with a verified sender address, ideally `no-reply@auth.<founder-owned-domain>`, display name `Privelier`, and a separate support inbox. This is preferable to using a personal Outlook mailbox: Exchange Online SMTP AUTH is commonly disabled by security defaults and requires a mailbox-specific administrative configuration.

No SMTP password, provider API key, or Microsoft credential belongs in this repository, Expo environment, client bundle, or chat.

## Founder steps

1. Choose and approve an SMTP provider. Supabase supports standard SMTP providers; this is a founder decision because it adds cost and a processor for authentication email.
2. Verify the sending domain with SPF, DKIM, and DMARC at the DNS host.
3. In Supabase Dashboard, open Authentication > Emails > SMTP Settings. Set host, port, username, password, sender address, and sender name `Privelier`.
4. In Authentication > Rate Limits, set a tested, provider-approved email rate that can support the planned launch. Custom SMTP begins at 30 messages/hour unless changed.
5. Set branded, minimal templates for confirmation, recovery, email change, and invite flows. Keep the existing deep-link callback URL intact.
6. Send confirmation and password-recovery messages to real non-team test inboxes. Confirm sender name/address, DKIM/SPF alignment, link integrity, spam placement, expiration behavior, and rate-limit errors.

## Outlook note

For a Microsoft 365 mailbox, SMTP AUTH must be enabled only for the dedicated sending mailbox and its credentials must remain in Supabase Dashboard configuration. Do not weaken organization-wide security defaults or enable it broadly just to send app email. A consumer Outlook.com account is not an appropriate operational dependency for a production authentication channel.

## References

- Supabase custom SMTP setup and production cautions: <https://supabase.com/docs/guides/auth/auth-smtp>
- Supabase production checklist: <https://supabase.com/docs/guides/deployment/going-into-prod>
- Microsoft Exchange Online SMTP AUTH controls: <https://learn.microsoft.com/en-us/Exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission>
