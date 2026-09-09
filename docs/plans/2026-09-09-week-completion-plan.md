# Privelier week-completion plan

Status: active
Created: 2026-09-09
Target: Sunday 2026-09-13, Africa/Cairo

## Outcome

Deliver a code-complete MVP release candidate for the Customer and Barber apps. The release candidate must cover the complete in-scope journey:

`signup -> barber verification -> service and availability -> discovery -> booking -> accept/reject -> chat -> complete -> review`

“Production released” is a separate claim and requires the external device, schema, policy, and store gates listed below to pass. No gate will be silently represented as complete.

## Product-first operating rules

- App code and visible UX take priority over maintenance documentation, dependency archaeology, and non-blocking cleanup.
- Each behavior-changing feature still follows `Plan -> Design -> Build -> Validate -> Secure -> Integrate -> Release`.
- Only one feature is actively built at a time.
- Commit and push after each completed feature slice. Keep documentation to the minimum status update needed for recovery.
- Supabase schema, migrations, RLS, storage policies, and hosted database changes remain owned by `supabase-schema-architect`; use `/supabase-schema-sync` after an approved migration.
- Do not add payments, push notifications, AI recommendations, multi-country logic, automated KYC/biometrics, OAuth server work, or a separate admin app this week.

## Remaining execution order

### W01 — Portfolio upload

Replace the unfinished upload state with a real portfolio flow in the Barber app: choose an image, show progress, handle success and failure, delete an image, preserve the six-image hard limit, and provide honest loading/empty/error states. Reuse the existing storage/data contracts and test IDs where they already exist.

Close criteria: focused component/data tests, max-six adversarial coverage, storage/security review, lint/typecheck, and a committed/pushed feature slice.

### W02 — Manual verification submission

Complete the Barber verification surface for ID and license uploads, including per-document progress, partial submission, pending, rejected, resubmission, and approved states. Documents remain in the private Supabase bucket. Founder review remains manual through the Supabase dashboard; no OCR, selfie, face matching, or biometric processing.

Close criteria: real submission path, private-storage/RLS review, focused tests, and a runnable barber-to-founder approval path.

### W03 — Booking integrity

Re-verify the live database authority for past dates, availability windows, duration overlap, and concurrent booking attempts. If any rule is still bypassable through a raw authenticated request, run a separate schema-owner pipeline for the forward-only migration and synchronize it live. Add matching client error states without weakening the state machine.

Close criteria: schema-owner approval, migration/live verification, authenticated allow/deny probes, overlap/concurrency coverage, and no invalid booking accepted by the raw API.

### W04 — Visible UX completion

Run a focused Sol 5.6 Ultra pass across the actual remaining defects, not a speculative rewrite:

- remove or implement Account controls that are currently no-op;
- add the unsaved-draft guard to LocationEdit;
- ensure Studio readiness has five truthful items, including bio;
- verify every in-scope screen has loading, empty, error, success, disabled, and pressed states;
- verify 44px touch targets, accessible labels/states, keyboard behavior, and the locked Privelier visual system;
- preserve the separate Customer and Barber navigation trees.

Close criteria: no visible “open soon” or fake control remains in the MVP path, focused UI tests pass, and route/deep-link contracts remain intact.

### W05 — Existing realtime, chat, and review gates

These features are already substantially implemented, so this is validation and defect repair only. Run the two-user booking status, reconnect, chat send/receive, read receipt/typing, completion, and review journey. Fix only defects exposed by the run; do not expand scope.

Close criteria: two-direction evidence where the environment permits it, corrected Maestro coverage for five readiness rows, and the complete real-test-user journey passing.

### W06 — Release candidate

Run the final security, RLS/storage, secret-history, test, typecheck, lint, export/build, accessibility, and performance checks. Reconcile the backlog and handoff, commit the release candidate, and push it. Report separately what is code-complete and what remains externally blocked.

## Deadline schedule

| Date | Work | Required output |
|---|---|---|
| Wed Sep 9 | Freeze non-blocking maintenance; prepare test environment | Portfolio is the next active feature; no advisory detours |
| Thu Sep 10 | W01 portfolio pipeline | Working upload/delete/cap flow committed and pushed |
| Fri Sep 11 | W02 verification pipeline | Working private document submission and manual-review states |
| Sat Sep 12 | W03 booking-integrity pipeline, then W04 UX completion | Invalid bookings blocked; unfinished visible UI removed or implemented |
| Sun Sep 13 | W05 validation and W06 release candidate | Full E2E result, security result, pushed release candidate, honest blocker list |

## External gates

The following are not safe to fake or infer:

- an authorized Android device and safe test accounts for Maestro/two-user flows;
- Maestro installation and device connectivity;
- founder/schema-owner direction on the remote-only `public.waitlist` table;
- the approved booking timezone policy if the integrity migration needs it;
- founder-controlled iOS/Apple access for iOS release evidence;
- any required provider/store credentials.

If these are unavailable, the code can still advance, but the final status must be `code-complete, release evidence blocked` rather than “fully released.”

## Resume contract

When the founder says **“continue building the app”**, resume this plan at the first incomplete execution row. The current resume point is **W01 — Portfolio upload, Plan phase**. Do not restart the repository baseline, reopen accepted dependency findings, or spend the session writing a replacement plan unless the founder changes the scope.
