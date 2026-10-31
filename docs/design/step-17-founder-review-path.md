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
- **The two documents arrive INDEPENDENTLY, one at a time** (`VerifyScreen.handleUpload(docType)`
  submits per document). Since migration 0020 both image columns are nullable, so a request row
  legitimately exists with one document present and the other `NULL` — that is the normal
  intermediate state between the barber's two picks, not a fault. (Before 0020 both columns were
  `NOT NULL`, which made the first single-document submission impossible and meant verification
  submission never worked at all — see that migration's header.) A CHECK
  (`chk_verification_requests_has_document`) guarantees at least one document is present, so an
  empty request cannot reach this queue; it does **not** guarantee both.
- `barber_profile.verification_status` for a brand-new barber is `pending` (forced by the
  `protect_barber_verification_fields` trigger on insert).

## The discovery chain (verified live 2026-07-13)

`barber_directory` view =
`users ⋈ barber_profile WHERE barber_profile.verification_status = 'approved'`.

That is the **only** gate on discoverability. Confirmed live: approved barber "T" appears in
`barber_directory`; pending barber "Ali" does not. `verified` (boolean) and
`verification_requests.status` do **not** affect discovery — they drive UI (the verified badge)
and the audit trail respectively.

## Founder procedure — APPROVE or REJECT a barber

1. **Storage → `verification-docs` bucket.** Open the barber's ID and license images and eyeball
   them. (Private bucket; the dashboard previews them with service credentials.)
2. **SQL editor**, one call (migration 0069):

   ```sql
   select private.review_barber_verification(
     '<barber user id>', 'approved',   -- or 'rejected'
     '<your founder user id>');
   ```

   It writes `barber_profile.verification_status` + `verified` and
   `verification_requests.status` + `reviewed_by` + `reviewed_at` in one transaction, and
   **refuses an approval while either document is missing** (a request with one document is the
   normal state between the barber's two uploads — leave it pending). No app role can call it.
3. Confirm: an approved barber now appears in `barber_directory`; a rejected one sees the rejected
   state on the Verify tab and can re-upload.

## Resubmit behaviour (migration 0015 trigger — verified live)

`requeue_verification_on_resubmit` on `verification_requests`: when a barber re-uploads (either
image url changes), `status` is forced back to `pending` automatically — **unless** the writer is
`service_role`. So a rejected barber who re-uploads re-enters the queue with no founder action.
Note this trigger touches only `verification_requests.status`; it does **not** reset
`barber_profile.verification_status` back to pending. If a founder had already approved and the
barber later changes their docs, the profile stays approved while the request goes pending — see
the gap below.

## Editing the tables by hand

Avoid it; use the function above. `protect_barber_verification_fields` (migration 0005) reverts
`verified`/`verification_status`/`rating` on any write unless `auth.role() = 'service_role'`, so a
raw SQL edit silently reverts unless it first runs
`select set_config('request.jwt.claim.role', 'service_role', true);` in the same transaction.

## Remaining gap

The resubmit trigger re-queues only `verification_requests`; an approved barber who later
replaces a document stays approved (and discoverable) until a founder reviews the new request.
