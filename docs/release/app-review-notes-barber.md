# App review notes: barber experience

Paste into App Store Connect > App Review Information and Play Console > App access. Real credentials go only into those consoles, never into this file.

## Demo account

- Barber: `<review-barber email>` / `<password in App Store Connect only>`
- The account is pre-approved, with services, weekly availability and portfolio photos, so every screen has content.

## What a barber does

1. Open the app and choose "Continue as barber", then sign in with the demo account.
2. Studio shows upcoming appointments and simple statistics.
3. Requests lists booking requests from customers; accept or decline them. Accepted bookings can be completed after the appointment.
4. Services, availability, days off and portfolio (at most six photos) are edited from Studio.
5. Chat is one conversation per booking, with quick replies.

## Verification (manual, no biometrics)

A new barber uploads a photo of an ID document and of a professional licence. The founders review both by hand in the Supabase dashboard and approve or reject the barber. Until approved, the barber is invisible to customers. The documents sit in a private storage bucket that only the barber who uploaded them and the founders can read. There is no automated identity, face-matching or biometric processing.

## Location (when in use only)

Location is asked only when the barber taps "On my way" for an accepted booking, and only "while using the app". During that trip the customer sees the barber's position and arrival time; sharing stops when the barber arrives, ends the trip or the booking closes, and the position is deleted. Location is never needed to sign up, sign in or use the rest of the app. Android does not request background location.

## Photos

The system photo picker is used, so the app never gets access to the whole photo library. Every uploaded photo is re-encoded, which removes location and other metadata before upload.

## User-generated content, blocking and deletion

The same reporting, blocking, content filter, terms and account deletion apply as described in `app-review-notes-customer.md`. A barber deleting their account rejects their pending requests and cancels upcoming bookings; customers are notified.

## Support

`privelier@outlook.com` (Studio > Settings > Help and contact).
