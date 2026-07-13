# Step 17 — Manual verification: founder review path (dashboard-only)

Founder decision (2026-07-13): **no in-app admin view for Phase 1.** Founders review and
approve/reject barbers directly in the Supabase dashboard. This document is the authoritative
procedure. It was written against the live DB, not from assumption.

## What the app already does (the upload half — DONE)

- Barber uploads ID photo + license photo from the Verify tab.
- Images land in the **private** `verification-docs` storage bucket (migration 0015). They are
  never public; only the dashboard (service credentials) and the owning barber can read them.
- A `verification_requests` row is created/updated for that barber with `status = 'pending'`,
  `id_image_url`, `license_image_url`.
- `barber_profile.verification_status` for a brand-new barber is `pending` (forced by the
  `protect_barber_verification_fields` trigger on insert).

## The discovery chain (verified live 2026-07-13)

`barber_directory` view =
`users ⋈ barber_profile WHERE barber_profile.verification_status = 'approved'`.

That is the **only** gate on discoverability. Confirmed live: approved barber "T" appears in
`barber_directory`; pending barber "Ali" does not. `verified` (boolean) and
`verification_requests.status` do **not** affect discovery — they drive UI (the verified badge)
and the audit trail respectively.

## Founder procedure — APPROVE a barber

1. **Storage → `verification-docs` bucket.** Open the barber's ID and license images and eyeball
   them. (Private bucket; the dashboard previews them with service credentials.)
2. **Table Editor → `barber_profile`**, find the barber's row, set **both**:
   - `verification_status` = `approved`
   - `verified` = `true`
   (These do not auto-sync — a trigger would be needed and none exists. Set both or the badge and
   the discovery gate disagree.)
3. **Table Editor → `verification_requests`**, same barber's row, set:
   - `status` = `approved`
   - `reviewed_by` = the founder's user id
   - `reviewed_at` = now
4. Confirm: the barber now appears in `barber_directory` (they are discoverable to customers).

## Founder procedure — REJECT a barber

Same as above but `verification_status`/`status` = `rejected` and leave `verified` = `false`.
The barber stays out of `barber_directory`. On the barber's Verify tab they see the rejected
state and can re-upload.

## Resubmit behaviour (migration 0015 trigger — verified live)

`requeue_verification_on_resubmit` on `verification_requests`: when a barber re-uploads (either
image url changes), `status` is forced back to `pending` automatically — **unless** the writer is
`service_role`. So a rejected barber who re-uploads re-enters the queue with no founder action.
Note this trigger touches only `verification_requests.status`; it does **not** reset
`barber_profile.verification_status` back to pending. If a founder had already approved and the
barber later changes their docs, the profile stays approved while the request goes pending — see
the gap below.

## Why the Table Editor (not raw SQL) for these edits

`protect_barber_verification_fields` (migration 0005) reverts
`verified`/`verification_status`/`rating` on any write **unless** `auth.role() = 'service_role'`.
The dashboard Table Editor sets that role automatically, so edits stick. A raw Management-API SQL
session does not — it silently reverts. If you must use SQL, first run in the same call:
`select set_config('request.jwt.claim.role', 'service_role', false);`

## Known gap (not blocking Phase 1, tracked)

The two status surfaces — `barber_profile.verification_status` (+`verified`) and
`verification_requests.status` (+`reviewed_by`/`reviewed_at`) — are **not** linked by any trigger.
A manual dashboard flow must keep them consistent by hand, and the resubmit trigger only re-queues
the request, not the profile. Acceptable for two founders doing low-volume manual review, but the
right long-term fix (Phase 2, or whenever an in-app admin view is built) is a single
`service_role`-owned approval path (RPC or Edge Function) that writes both tables atomically.
Route any such change through `supabase-schema-architect`.
