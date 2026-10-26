# App review notes: customer experience

Paste into App Store Connect > App Review Information and Play Console > App access. Real credentials go only into those consoles, never into this file.

## Demo account

- Customer: `<review-customer email>` / `<password in App Store Connect only>`
- Its profile city matches the demo barber's city, so the barber appears on Discover at once.

## How to see a barber

1. Open the app and choose "Continue as customer", then sign in with the demo account.
2. Discover shows verified barbers in the account's city. The demo barber (`<review-barber name>`) has services and open times every day.
3. Open the barber, pick a service, a time and an address, and send the request. It stays "pending" until the barber accepts (the founders can accept from the demo barber account during review).
4. Explore shows the same barbers on a map at an approximate position (offset 200 to 500 m; the real address is never shown).

## Verification

Every barber in the app was checked by hand by the founders: an ID document and a professional licence are reviewed before a barber can appear. There is no automated identity or biometric check. The demo barber is pre-approved.

## User-generated content (guideline 1.2)

- Chat is one conversation per booking. Long-press any message from the other person to report it; the header menu reports or blocks the person.
- Each written review on a barber's profile has a report button (flag icon).
- A block stops new messages and booking requests in both directions and hides the barber from discovery.
- Messages and review comments are checked against a list of prohibited terms on the server before they are stored.
- Sign-up requires accepting terms that state zero tolerance for abusive, threatening or objectionable content.
- Support: `privelier@outlook.com` (Account > Help).

## Account deletion (guideline 5.1.1(v))

Account > Delete account. The user types DELETE to confirm; the server cancels upcoming bookings, deletes the account and its photos and documents, and keeps the other person's booking and chat history without the deleted user's name.

## Permissions

- Location: never requested in the customer experience.
- Photos: not requested; there is no photo upload in the customer experience.
- Notifications: asked once, right after the first booking request, to tell the customer when the barber replies.
