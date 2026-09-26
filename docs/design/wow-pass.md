# Privelier WOW Pass

Owner: Taha (founder)
Executor: Codex
Started: 2026-09-25

## Wave 0: screen audit

This inventory is based on the current React Native source and navigation graph. The repository graph was fresh across 242 tracked code files at audit time. No Android device was connected, so this is explicitly a code-only baseline; no before screenshots were captured. Add before/after images beside each screen as device builds become available.

The current app already has a strong flat charcoal/ivory/brass base, real-data empty states, stable test IDs, and generally thoughtful error handling. The craft gap is systemic: most feedback is static opacity or a spinner, images use the base React Native image component, lists refetch from scratch, and the UI is hardcoded in English with a few isolated German strings.

### Cross-app surfaces

| Screen / surface | Current problems | Planned improvement | Wave |
| --- | --- | --- | --- |
| App launch and session restore | Native splash correctly stays up during auth restore, but account provisioning and link verification fall back to centered spinners. There is no global offline state or queued-action explanation. | Keep the truthful splash behavior; use branded layout skeletons or restrained progress states, add the offline banner and action policy, and preserve deep-link intent through authentication. | 1, 5 |
| Customer and Barber tab bars | Static tint and native unread badges work, but selection has no haptic or moving indicator. Labels and badges have not been audited at large text sizes. | Add a reduced-motion-aware active indicator, haptic selection, stable badge sizing, and large-text/accessibility checks while preserving both apps' separate navigation. | 1 |
| List and detail loading | Discover is the only screen with a content-shaped skeleton. Nearly every other data screen uses `ActivityIndicator`; no list currently exposes pull to refresh. | Add screen-shaped skeletons without empty-state flash, pull to refresh, stale-while-revalidate caching, prefetch, and partial-data preservation. | 1 |
| Motion and press feedback | Motion tokens only cover three durations and opacity; most tappables dim to 0.85. Reduce Motion is currently handled only by the skeleton, portfolio delete animation, and map camera animation. | Centralize Reanimated motion tokens and reduced-motion behavior; use 0.97 press scale, screen/list entrances, sheet and tab motion, count-up and checkmark patterns. | 1 |
| Images and avatars | Remote media uses React Native `Image` without cache/blur placeholders. Missing photos are single letters, a generic icon, or a large initial block. | Use cached `expo-image` media with blurred placeholders and a shared deterministic warm-tint monogram with brass hairline ring. | 1 |
| Feedback and confirmations | Destructive and permission flows use native alerts across bookings, requests, services, availability, portfolio, verification, bio, and location. Save success is usually only navigation. | Replace applicable alerts with the shared bottom sheet; add centralized haptics, toast/snackbar feedback, and the five-second cancellation undo window. | 1 |
| Typography, dates, and numbers | Formatters are fixed English and render euro as a prefix. There is no tabular numeral style; the booking review total uses Playfair, while a Services row renders a raw number without any currency. Wide tracking remains on statuses, tabs, member labels, and editorial labels. | Add locale-aware formatters, tabular lining numerals for money/time/stats, consistent sentence case, and a copy sweep for stray em dashes and excessive tracking. | 1, 6 |
| Accessibility and keyboard behavior | Many controls have good labels, roles, focus order, and stable test IDs. Small filter/action chips still need a 44pt audit; dynamic type has not been verified; tap-outside dismissal is inconsistent; optional signup fields are skipped by the Next chain. | Audit every interactive target, large text layout and screen-reader state; complete field focus chains, blur/submit validation, tap-outside dismissal, and reduced-motion fallbacks. | 1 |

### Authentication and legal

| Screen | Current problems | Planned improvement | Wave |
| --- | --- | --- | --- |
| Role selection | Clear accessible role cards and brandmark, but all copy is English and the transition is static with opacity-only feedback. The fixed, non-scrollable centered layout can clip with large text or on short screens. | Make the threshold layout resilient to dynamic type, localize it, and add restrained screen/card entrance, press feedback, and haptic role selection. | 1, 6 |
| Auth entry | Login/create-account choices are clear but static and English-only. | Apply localized warm role-specific copy and standard screen/button motion. | 1, 6 |
| Login | Autofill and required-field keyboard flow are good. Errors validate on submit only, copy mixes English with a German role-mismatch message, and OAuth/submit feedback is spinner-only. | Validate on blur/submit, localize consistently, preserve entries on recoverable errors, and use the shared feedback/motion patterns. | 1, 6 |
| Signup | Honest customer/barber variants and legal consent exist. The long form lacks progressive structure; optional country/phone/bio fields are skipped by Next; validation is submit-only. | Improve field rhythm and keyboard traversal, validate touched fields on blur, localize autofill-friendly copy, and add contextual haptic/success feedback. | 1, 6 |
| Finish setup | Functional OAuth completion with role and legal consent, but it repeats the long static form and has no complete keyboard chain. | Match signup form behavior and localization, with preserved input and a clear provisioning handoff. | 1, 6 |
| Await email confirmation | Resend and change-email actions exist, but the success state is static and the view does not survive restart by design. | Localize and add a restrained mail/check state plus clear next-step copy; retain the correct restart behavior. | 1, 6 |
| Forgot password | Functional inline sent/error feedback, but static and English-only. | Localize, validate on blur/submit, and use a calm success toast/state transition. | 1, 6 |
| Reset password and auth-link error | Opening a link uses a bare spinner; expired/error variants are text-only. | Use branded link-verification skeleton/progress, localized recovery actions, and a clear route back to requesting a link. | 1, 6 |
| Provisioning | Brandmark and retry/sign-out failure path are sound, but first-login setup is still a spinner on otherwise empty space. | Replace the first-load spinner with a restrained branded progress treatment that respects Reduce Motion. | 1 |
| Admin unsupported | Correctly blocks mobile admin use, but is English-only and visually bare. | Localize and align with the shared intentional empty-state treatment. | 1, 6 |
| Legal documents | Reachable from auth and account, but the document screen is partly German while the surrounding app is English and visibly says the text is a nonbinding draft. | Localize navigation and document selection while keeping legal text authoritative; remove the draft badge only after founder/legal sign-off. Final legal copy remains a store-release gate. | 6, 7 |

### Customer app

| Screen | Current problems | Planned improvement | Wave |
| --- | --- | --- | --- |
| Discover | Real verified barbers and services are shown, with the app's only full skeleton. Greeting and cards are static; search has no recent terms or clear action; there are no favorites or real next-available times. “Barber spotlight” is an arbitrary deterministic daily rotation by barber ID, which can imply an editorial endorsement that does not exist. | Animate the greeting lightly; add instant search, recent terms, clear, favorites/filter, prefetch, and one batched real-availability query. Lead with real earliest availability or a neutral directory instead of arbitrary spotlight status. | 1, 2 |
| Explore | Real list/map data and honest no-map/no-pin states exist. Initial load is a spinner, there is no refresh/cache, and “the map arrives with the next app update” makes a release promise the client cannot guarantee. “Works today” checks working hours but ignores busy slots, so a fully booked barber can match; “Verified” is redundant because the directory is already approved-only. | Add skeleton/cache/refresh and haptic filter/toggle feedback; calculate availability from real free slots, replace the redundant filter with Favorites, and use capability-neutral map fallback copy. | 1, 2 |
| Barber profile | Real services, portfolio, reviews, verified state and partial-load errors exist. The no-photo hero is a giant initial; loading is a spinner; profile errors have no retry; hero/tabs are static; no favorite/share/sticky booking bar/fullscreen gallery/distribution. | Build the monogram/textured fallback, parallax and collapsing verified header, sticky “Buchen ab …” bar, favorite/share deep link, zoom gallery, real rating distribution, newest-first reviews, skeleton and retry. | 1, 2, 5 |
| Booking: date and time | Real availability is fetched and slots are already grouped by morning/afternoon/evening; unavailable days are muted. The 14-day view currently makes one busy-slot request per date. It uses a spinner, static three-dot step marker, no density dots, next-slot shortcut, haptics, or selection animation. | Batch availability/busy data in one call, then add animated named steps, density dots from real slot counts, next-available shortcut, skeleton, localized periods, haptics, and restrained selection motion. | 1, 2, 6 |
| Booking: location | Current free-text street/city/unit/instructions are honest and city-prefilled. Validation appears while a partially completed address is still being typed; placeholder is English; there is no autocomplete, saved address/label, or distinct access note model. | Validate touched fields on blur/submit, add Mapbox autocomplete, saved labeled addresses and last-used prefill, localized placeholder, and optional access notes. | 1, 2, 6 |
| Booking: review | Summary is clear, but there is no static map or itemized price treatment; “Estimated total” is misleading for a price snapshot; total uses serif old-style numerals. | Add map preview, lining-tabular price breakdown, exact “pay the barber directly” wording, and haptic/pressed confirmation. | 1, 2, 6 |
| Booking success state | Only a static check icon, one sentence, and “View bookings” are shown. The screen retains the returned price but not the created booking ID, so calendar, chat, reminder, sharing and detail actions cannot yet target the booking. | Retain the authoritative created booking row/ID; add reduced-motion-aware check/ring, full summary, truthful next-step timeline, add-to-calendar, message-barber and bookings actions, plus contextual reminder permission. | 2 |
| Bookings | Upcoming/past lists preserve realtime rows, but cards are not tappable; statuses are tracked plain text; one-letter avatars and large red cancel buttons dominate; initial load is a spinner; cancellation is immediate after a native alert. | Make calm pressable cards open Customer booking detail; use status pills/monograms/skeleton/refresh, move destructive action into detail, and delay cancellation behind undo. | 1, 2 |
| Customer booking detail (new) | No route exists, so booking cards cannot answer status, directions, calendar, sharing, messaging, repeat booking, review, or cancellation context. | Add the customer-specific detail screen with realtime timeline, map/address, calendar/message/share/cancel actions, reasons and undo, review/rebook states, and reminder deep links. | 2, 5 |
| Inbox | Unread handling and real thread previews work. Initial load is a spinner; avatars are one initial; rows omit appointment date/status and have no refresh/cache. | Apply monograms/cached photos, skeleton/SWR/refresh, clearer booking context, animated unread changes, and localized dates. | 1, 4, 6 |
| Customer conversation | Realtime, paging, optimistic send/retry, typing and final-message read receipt work. Header has no avatar/date/status, there is no pinned booking card or day separators, and every bubble carries a timestamp. Initial-load error has no retry; the composer lacks an explicit accessibility label. Send feedback is static; copy/address/phone actions are absent. | Add retry and accessible composer semantics, contextual header and pinned booking card, grouped bubbles/day separators, group or long-press time, animated brass send, haptic, clipboard, tappable phones/addresses, and polished typing/unread motion. | 1, 4, 5 |
| Review submit | Real post-completion review, accessible stars, optional bounded text and retry exist. It is a full screen reached manually from history, with a static success state; the comment input lacks an explicit accessibility label. | Present the two-tap review sheet after completion, label all inputs, add haptic stars, abuse screening/limits, Fade-Rhythmus reminder choices, and one-time store-rating request after the third completion. | 2, 7 |
| Account | Edit profile, privacy/help, legal links and sign-out exist. There is no dedicated loading state, so fallback “Member” content can flash before the profile arrives. Avatar is one initial; “Member” has wide tracking; there is no member-since date, cut history, favorites, saved addresses, reminders, language, delete-account flow, or refined sign-out confirmation. | Add monogram/photo header with real member-since date, skeleton, “Deine Schnitte,” and real settings for addresses, favorites, reminders, language, legal/help, sign out and secure account deletion. | 1, 2, 6, 7 |
| Edit profile | Name/city/country save works, but there is no title or skeleton. Load and save failures share one retry action; after a save failure, “Try again” reloads and can discard the user's unsaved edits. | Add heading/skeleton, split load and save recovery, preserve edits, validate on blur/submit, complete keyboard actions, and show saved toast. | 1, 2, 6 |
| Privacy & security / Help | Both routes exist; Privacy is static copy and Help only opens email. | Turn these into real settings/help surfaces; add block/report management and account deletion entry where appropriate. | 2, 7 |

### Barber app

| Screen | Current problems | Planned improvement | Wave |
| --- | --- | --- | --- |
| Studio dashboard | Strong real analytics/readiness/management structure. Initial load is spinner-only; stats and chart are static; English and German are mixed in one analytics card; next appointment lacks countdown, route, and day agenda. Fixed horizontal metric/insight rows can compress under large text. | Add skeleton/SWR/refresh, count-up/chart draw and bar detail, localized copy, dynamic-type stacking, today's timeline with truthful gaps, next-appointment countdown/route, and public-profile preview. | 1, 3, 6 |
| Requests | One flat ascending list mixes pending, accepted, completed, rejected and cancelled bookings. Cards are not detail links; statuses are wide-tracked text; destructive actions use native alerts; no swipe actions, route/calendar, or on-the-way quick message. | Section into Needs action, Today, Upcoming and collapsed History; open Barber booking detail; add status pills, accessible swipe plus buttons, sheets/reasons, success haptic/transitions, calendar/route and ETA chat actions. | 1, 2, 3 |
| Barber booking detail (new) | No Barber detail route exists, leaving accepted/today/history cards without a focused action surface. | Add a separate Barber UI with realtime status timeline, customer/service/date/price/address map, route/calendar/message/share/cancel, complete, and on-the-way actions without adding booking states. | 2, 3, 5 |
| Services | Functional add/edit/delete form and real list. Price row bypasses currency formatting; duration/price are raw text inputs; the screen lacks keyboard avoidance/focus chaining; delete uses native alert; no reordering, steppers, preview, skeleton, or refresh. | Add keyboard-safe form behavior, formatted lining numerals, steppers, drag reorder, live customer-card preview, sheets/toasts/haptics, skeleton and refresh. | 1, 3, 6 |
| Availability | Functional weekly/specific-date windows, but editing is form-heavy with raw date/time text, native delete alert, spinner, and no visual week, copy-day/template, or closed/vacation model. Compact day/time controls can compress under large text, and repeated edit/delete screen-reader labels do not identify their window. | Build an accessible visual week editor with row-specific labels and dynamic-type stacking, pickers/sheets, copy-day/templates, and blackout dates after the required migration and validation update. | 1, 3 |
| Portfolio | Real six-image cap, optimistic removal and a reduced-motion delete animation exist. It uses native alerts, base `Image`, spinner loading, and has no reorder/fullscreen preview/refresh. | Use cached media/blur placeholder, sheets/toasts, skeleton/refresh, refined upload progress, and preview behavior consistent with the public gallery. | 1, 2, 3 |
| Chats | Real previews and unread state work. Loading is a spinner; avatar is a generic person icon; booking date/status context is absent. | Add monograms/photos, skeleton/SWR/refresh, richer real booking context and polished unread transitions. | 1, 4 |
| Barber conversation | Customer name is upgraded from real counterpart data and realtime/send/read/typing behavior is sound. Header still lacks avatar/date/status and the same bubble/context problems as Customer chat; there are no quick replies. | Apply the shared chat craft while preserving separate UI: pinned booking context, grouped messages, date separators, quick replies/ETA text, clipboard and tappable detected data. | 4 |
| Verification | Manual private-document flow is correctly preserved. Approved state still leaves disabled document rows visible and can show “Approved” beside “Not uploaded”; no verified-since date; document accessibility labels omit uploaded/action state; loading and upload failures use spinner/native alerts. | On approval show “Verifiziert seit <date>” and collapse documents; announce document/action state, add truthful skeleton/upload progress, sheets/toasts, localization, and keep manual-only privacy copy. | 1, 3, 6 |
| Bio edit | Bounded real bio, dirty guard and character feedback are good. Loading is a spinner; load error has no retry; discard uses native alert; no save toast. | Add skeleton/retry, sheet discard confirmation, save toast, localized copy and complete keyboard dismissal. | 1, 6 |
| Location edit | Mapbox suggestion selection and privacy copy are real and careful. Loading/search use spinners, discard uses native alert, and the editor is only directly linked from the Studio management row. | Add skeleton/refined search feedback, sheet/toast, and make every Barber-owned location presentation open this editor directly. | 1, 3, 6 |
| Barber settings / account (new) | The Barber app has no account/settings route; sign-out sits in the Studio header. That leaves no home for language, legal/help, security, or account deletion. | Add a calm settings entry from Studio with language, legal/help, sign out and secure deletion. Keep the five-tab role-specific navigation intact. | 6, 7 |
| Public profile preview, share and QR (new) | No Barber route previews the exact customer-facing profile or shares a deep link/QR. | Add “So sehen dich Kunden,” native share, and a real QR generated from `privelier://barber/<id>`. | 3, 5 |

### Additional audit findings and decisions

- Remove or redefine Discover's arbitrary daily spotlight before presenting it as editorial selection. A lead card may only claim availability or ranking when real data supports that claim.
- Refetch Discover when the customer returns from adding a missing city; the current mount-only load leaves the recovery path stale after Edit profile navigates back.
- Never label a barber “Works today” from working hours alone. Busy slots must be included before the UI makes an availability claim.
- Preserve customer edits after failed profile saves. Loading recovery and write recovery need separate actions.
- Route every displayed price through the same formatter and numeral style; the Services list currently renders a bare number.
- Retain the created booking ID on the success screen before adding calendar, chat, reminders, sharing, or detail navigation.
- Use capability-neutral copy when an optional native module is absent. “Arrives with the next app update” is not a promise the client can safely make.
- Add a Barber settings surface without replacing a core tab. Studio is the natural entry because it already owns profile management and sign-out.
- Treat the visible legal “draft, not legally binding” state as a release blocker, while leaving legal wording to the founders and qualified counsel.
- Keep separate Customer and Barber booking-detail and chat presentation. They may share non-visual utilities and data hooks, but their navigation and UI remain distinct.
- New report/block/delete-account surfaces in Wave 7 must be backed by the required secure schema/function work before their UI is exposed.

### Screenshot log

No device or emulator was available during Wave 0 (`adb` reported no connected devices), so this pass has no defensible visual screenshots. Capture each affected screen before its first implementation change and after native verification, and link both images from the relevant table row.

## Wave 0: dependency inventory

The app is on Expo SDK 57, React Native 0.86, and Reanimated 4.5.1. Install every new native module in **one** `expo install` command before the first new development build. No later wave may add another native package without revisiting this build contract. Expo's [SDK 57 compatibility table](https://docs.expo.dev/versions/v57.0.0/) and [package installation guidance](https://docs.expo.dev/workflow/using-libraries/) determine pinned versions.

| Package | Kind | Why it is needed |
| --- | --- | --- |
| `expo-haptics` | Native | Central selection, confirmation, success and warning feedback. |
| `expo-calendar` | Native | Add, update and remove appointment events for either role. Calendar access is requested in context. |
| `expo-image` | Native | Cached profile, avatar and portfolio media with placeholder/crossfade support. |
| `expo-notifications` | Native | Device-local booking and fresh-cut reminders only; no push token, server push, or background remote mode. |
| `expo-localization` | Native | Device language and native supported-locale configuration. |
| `@react-native-community/netinfo` | Native | Honest offline state and React Query online management. |
| `expo-clipboard` | Native | Long-press chat copy. |
| `react-native-gesture-handler` | Native | Accessible swipe actions, gallery pinch and bottom-sheet gestures. [Expo SDK 57 recommends 2.32](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/). |
| `@gorhom/bottom-sheet` | JS with the native peers above | Confirmation and picker sheets with keyboard and gesture support. Its current 5.2.14 peer metadata accepts Reanimated 4; validate it in the development builds. |
| `@tanstack/react-query` | JS only | Shared stale-while-revalidate cache, prefetch and offline retry policy, scoped by signed-in user and cleared on sign-out. |
| `i18n-js` | JS only | A small German/English translation layer with key-parity tests. |
| `qrcode` and `@types/qrcode` | JS only | Compute a real profile-link QR matrix for the already-installed `react-native-svg` renderer. |

Already installed: `react-native-reanimated`, `react-native-svg`, `expo-store-review`, React Native `Share` and `Linking`, and Mapbox. They need no new native package. The QR is generated locally; sharing and maps use platform APIs. [Expo's localization guide](https://docs.expo.dev/guides/localization/) supports per-locale iOS permission strings through `expo.locales`. Set German and English calendar usage descriptions there, declare both supported locales, and add the notification config plugin without remote-notification background capability. Calendar event update/removal requires the access level appropriate to the [Expo Calendar API](https://docs.expo.dev/versions/v57.0.0/sdk/calendar/), so request it only when the user chooses calendar integration. Android calendar permission scope and notification channels are verified during the native build. No notification permission is requested on app launch.

The conditional home-screen quick-actions item is parked: [`expo-quick-actions`](https://github.com/evanbacon/expo-quick-actions#versioning) currently lists matched Expo releases only through SDK 56, so it is not a safe addition to the one-time SDK 57 native batch without a tested compatible release. Optional biometric unlock is parked because this project's authoritative no-biometric rule has not been explicitly changed for app unlock. These decisions do not affect the core booking and chat journeys.

### Wave sequence and gates

Each item follows Plan → Design → Build → Validate → Secure → Integrate → Release, with typecheck, lint, the full Jest suite, affected Maestro flows, a descriptive commit, and a design-record update. Pull before each wave and push completed waves to `origin/main`. New favorites, saved addresses, blackout dates, reporting/blocking, and account deletion require local migrations with RLS/security review; print each migration and its `supabase_migrations.schema_migrations` insert for Taha to run, await confirmation, then verify read-only before dependent client code. Keep local notifications separate from prohibited server push, and keep the existing booking status values and actor rules unchanged.

### Baseline checks

On 2026-09-25, before implementation: TypeScript passed; Expo lint exited zero with 19 pre-existing warnings; Jest passed 56 suites and 599 tests. `adb devices -l` showed no attached device. Maestro and EAS CLIs are installed, but no native flow or visual check ran during Wave 0.

## Wave 1: native foundation batch

Installed the eight planned native modules together before any development build. Added the four JS runtime packages and QR types in the same dependency item. The Expo installer could not write plugin entries automatically because this app uses a dynamic `app.config.js`; the packages installed successfully, and the required entries were added to the static `app.json` that the dynamic config extends. The effective config now contains image, localization, calendar and notifications plugins, German and English locales, and Android calendar permissions from the calendar plugin. Notification background remote mode remains disabled. The system notification permission prompt itself has no custom iOS usage-description key; app explanatory copy will be localized in Wave 6.

Expo's compatibility check found three existing SDK 57 patch packages behind its current recommendations. Aligned `expo`, `expo-image-picker` and `expo-linking` before building, in this same native batch. No further native additions are planned. Calendar permission is full access because updating/removing an event by stored ID is part of the founder's requested behavior; access will only be requested when a user selects calendar integration. The locale files provide German and English system permission text, with English as the default config string.

Validation after this item: `npm run typecheck` passed; `npm run lint` passed with the same 19 warnings; full Jest passed 56 suites and 599 tests; `npx expo install --check` reported current dependencies; `npx expo-doctor` passed 21/21 checks. Native device behavior, build links, and screenshots are pending development builds and an attached device.

Android development build [23e11772-3758-40d4-8724-40d18c7d90c6](https://expo.dev/accounts/aatt/projects/privelier/builds/23e11772-3758-40d4-8724-40d18c7d90c6) finished successfully from commit `e3c4599`; [the installable APK](https://expo.dev/artifacts/eas/Q_yS6o8iSC_Lavg--uKDqWS8NE4e8eShnb3NbzAaO_U.apk) is available. The iOS attempt reached the Apple Developer login prompt: this EAS account has no credentials for internal iOS distribution, so no iOS build was submitted. The founder must complete interactive Apple credential setup or provide an approved `credentials.json`; the password must not be sent in chat. This does not block JS and Android implementation work. No device was connected to install or inspect the APK.

### Motion primitive item

Expanded the existing motion tokens with Reanimated timing, clamped spring and Reduce Motion values. A shared hook animates a press to 0.97 scale and returns to rest; when the OS requests reduced motion it uses only a brief opacity fade. `PrimaryButton` is the first consumer, keeping its 52pt target, theme colors, loading/disabled states, accessibility label and stable test ID. Existing screen tests needed a global Jest-only Reanimated mock because Worklets cannot initialize without a native runtime; focused motion tests override it to assert the animation calls. The mock does not run in the app.

Focused Jest passed 3 suites/13 tests. Full Jest passed 59 suites/612 tests after the integration fix. Typecheck passed; lint exited zero with the same 19 pre-existing warnings. The code graph was refreshed. No native visual or Reduce Motion device check was possible without an attached phone; the Android development build can be used for that check.

### Semantic booking status item

Added one accessible status pill for the authoritative booking statuses. Pending uses brass, accepted success, rejected error, and completed/cancelled muted tones. A subtle tone fill and hairline border replace wide-tracked text on Customer Bookings and Barber Requests. The pill announces `Status: <label>` when a live row changes; labels remain sentence case. Customer title/status can wrap and the Barber right column can shrink at larger text sizes. Existing row/action test IDs, transitions and Realtime handlers are unchanged. This item does not move cancellation actions or make cards tappable; those need the Booking Detail screen in Wave 2.

Focused Jest passed 3 suites/8 tests; full Jest passed 62 suites/620 tests. Typecheck and lint passed with the same 19 pre-existing lint warnings. No device screenshots or large-text native validation were possible without an attached device. Maestro flows keep their existing status and action test IDs; no interaction flow changed in this item.

### Monogram avatar and cached photo item

Added a shared monogram avatar with two initials from a real name, a deterministic warm tint from the user ID, and a thin brass ring. Real profile photos use Expo Image memory/disk caching, a neutral blurred placeholder, and a brief crossfade; a failed image returns to the monogram. Applied it to Discover barber cards, Customer bookings/inbox/account, and Barber requests/chats. When a linked profile has not loaded, the avatar shows no invented initial. Decorative avatars remain inside the existing accessible row target; the Account avatar announces the real name. The no-photo barber card is now an intentional large monogram, while the full profile hero will receive its separate Wave 2 treatment.

Focused Jest passed 8 suites/16 tests; full Jest passed 66 suites/629 tests. Typecheck and lint passed with the same 19 pre-existing warnings. No Maestro navigation/action contract changed. Native visual and screenshot checks remain open because no device is attached.

### Centralized haptics item

Added one safe haptics helper: light for selection, medium for primary confirmation, semantic success and warning for completed/destructive actions. Native haptic failures are swallowed so booking actions still complete. The Customer booking date and time selectors now request light feedback; booking submit requests medium feedback, and only a successful authoritative insert requests success feedback. The conflict path never announces success. No booking transition or selector test ID changed. Maestro continues to assert the observable date, slot, submit and success outcomes; it cannot sense device vibration.

Focused Jest passed 3 suites/6 tests; full Jest passed 69 suites/635 tests. Typecheck and lint passed with 19 pre-existing warnings and no errors. The code graph was refreshed. Native haptic feel still needs a physical device check.

### Lining numerals for prices and stats item

Added one Inter semibold lining/tabular numeral style for money and numeric highlights. Applied it to the Customer booking review total and cards, barber card prices and ratings, profile service prices and review score, map price pins, Barber request prices, and dashboard totals/metrics/rating/rank counts. The Barber services list now formats the real service price as euros instead of a bare number. Playfair remains for editorial words and headings; empty-state words such as “New” keep that voice. Date and time locale formatting remains in Wave 6, where the full time-label sweep will use tabular figures too.

The services Maestro flow now checks the formatted `€25 · 30 min` row. Focused Jest passed 3 suites/7 tests; full Jest passed 70 suites/636 tests. Typecheck and lint passed with 19 pre-existing warnings and no errors. Device visual comparison remains open without an attached phone.

### Booking-list skeleton item

Reused the existing flat, brand-toned Skeleton primitive to compose two booking-card placeholders for Customer Bookings and Barber Requests. The first load now previews avatar, name, service, price, date and status positions instead of a bare spinner; empty copy appears only after a completed empty response. Both loading test IDs stay stable for Maestro. The placeholders form one accessible progress announcement, while decorative blocks stay out of the accessibility tree. The Skeleton pulse now reads the central Reduce Motion preference at first render and becomes static when enabled.

Focused Jest passed 2 suites/4 tests; full Jest passed 70 suites/638 tests. Typecheck and lint passed with 19 pre-existing warnings. The rest of the list and detail screens still need their own content-shaped loading states; this item establishes the pattern. Native visual and motion checks remain open without a device.

### Conversation-list skeleton item

Customer Inbox and Barber Chats now show conversation-shaped first-load placeholders: avatar, name, preview and date. An empty state appears only after a completed empty response. Once real threads have loaded, returning to the tab keeps them visible during the refresh and retains them with a retry notice if that refresh fails. Existing loading, row and navigation test IDs remain. The Customer Maestro flow documents its stable loading ID; a new Barber chat-list flow checks login, loading, row and conversation navigation, subject to a real one-room test account.

Focused Jest passed 2 suites/4 tests; full Jest passed 70 suites/640 tests. Typecheck and lint passed with the same 19 pre-existing warnings. The new Maestro flow has not run because no device is attached.

### Booking-list pull-to-refresh item

Customer Bookings and Barber Requests now use a native pull-to-refresh control tinted with the theme brass. It calls each screen’s existing authoritative load path and keeps already rendered cards visible while fetching. First-load skeletons remain reserved for a list with no loaded rows. New list test IDs make the refresh control verifiable without changing card/action IDs. Both booking Maestro flows now pull down and check that a real row remains visible.

Focused Jest passed 2 suites/6 tests; full Jest passed 70 suites/642 tests. Typecheck and lint passed with the same 19 pre-existing warnings. The gesture still needs a native Maestro run; no device is attached.

### Conversation-list pull-to-refresh item

Customer Inbox and Barber Chats now expose the same brass native pull-to-refresh control. Refresh calls the existing focus-load data path; a prior thread preview remains visible during loading, and the prior content plus retry notice remains if the read fails. First load still uses conversation-shaped skeleton rows. Existing row/navigation IDs remain, with new list IDs for verification. Customer and Barber chat-list Maestro flows now pull down before opening a thread.

Focused Jest passed 2 suites/6 tests; full Jest passed 70 suites/644 tests. Typecheck and lint passed with 19 pre-existing warnings. Device gesture checks remain open.

### Customer Account profile-loading item

Customer Account now shows a profile-shaped skeleton while the first profile read is pending. The edit-profile target and member identity appear only after the real `users` row arrives; a failed read leaves a labeled retry action, settings and sign-out without invented profile data. A later focus refresh retains the prior real profile while loading. The login-to-Account Maestro flow waits for the loading state to clear and asserts the real edit target.

Focused Jest passed 1 suite/3 tests; full Jest passed 70 suites/646 tests. Typecheck and lint passed with 19 pre-existing warnings. Native visual checks remain open.

### Booking address validation item

The street and city fields now show short, field-specific errors only after blur, clearing each error as soon as the real input becomes valid. A profile city prefill no longer triggers a premature message. The street placeholder describes the expected field rather than showing a sample address. The disabled Continue control still protects the existing booking payload and state machine. The Customer booking Maestro flow checks that no error is present on entry; the full form journey remains unchanged.

Focused Jest passed 1 suite/2 tests; full Jest passed 71 suites/648 tests. Typecheck and lint passed with 19 pre-existing warnings. German/English placeholder and error copy will move into the Wave 6 translation layer.

### Booking address keyboard-flow item

The four address inputs now form a keyboard Return chain: street → city → optional unit → optional access instructions. The last Done action dismisses the keyboard and submits when the actual address is valid; otherwise it reveals both required-field errors without navigating. Dragging the form dismisses the keyboard. Existing field and Continue test IDs remain. Tap-outside dismissal and autofill hints will be handled in the broader form pass.

Focused Jest passed 1 suite/3 tests; full Jest passed 71 suites/649 tests. Typecheck and lint passed with 19 pre-existing warnings. Device keyboard behavior still needs a native check.

### Booking date and time loading item

The initial availability wait now shows neutral date chips and slot shapes under the existing loading test ID, without asserting that any date or time is bookable. A refocus keeps previously verified availability visible while the authoritative read runs again, with Continue disabled during that check. A failed refresh shows retry above retained slots; an initial failure still shows the full error notice. The Customer booking Maestro flow retains its wait on the loading ID.

Focused Jest passed 1 suite/1 test; full Jest passed 72 suites/650 tests. Typecheck and lint passed with 19 pre-existing warnings. Native loading motion and slot layout remain unverified without a device.

### Barber Studio loading item

Studio’s first load now previews the real greeting, verification line, analytics card, chart, metrics and management row as quiet neutral shapes. It does not say “there” or show sample stats while the barber profile is pending. The sign-out target remains available. The existing `barber-dashboard-loading` Maestro selector now wraps this content-shaped state; inline retry spinners remain confined to explicit retry actions.

Focused Jest passed 1 suite/5 tests; full Jest passed 72 suites/651 tests. Typecheck and lint passed with 19 pre-existing warnings. Native visual checks remain open.

### Customer barber-profile loading item

The public barber profile first load now shows a neutral full hero, name/meta lines, bio, tabs and service rows rather than a spinner. These are shapes only: no false rating, service, portrait or empty state is shown before the real reads finish. The back action and existing `barber-profile-loading` Maestro ID remain. The no-photo hero composition itself remains scheduled for Wave 2.

Focused Jest passed 1 suite/1 test; full Jest passed 73 suites/652 tests. Typecheck and lint passed with 19 pre-existing warnings. Device visual checks remain open.

### Chat grouping and notification center item

Both chat headers now show the real counterpart photo or the existing branded monogram fallback, alongside the service and appointment context already loaded by the inbox. Consecutive messages share one timestamp, with centered Today/Yesterday/date dividers; read receipts are rendered as a visible brass double check while retaining their existing testID and real read-state source. Both apps now have an Account/Studio bell entry to a durable notification center. A new RLS-protected `notifications` table is filled only by trusted message/booking triggers and is published for realtime updates; user rows expose no message text, only participant identity and event references. It covers new messages, barber booking requests, and booking status changes for the other participant. Migration 0035 was applied directly to Supabase under Taha's prior authorization. No booking states, payments, server push, or new dependencies were added. UI strings follow the current English app; the planned de/en i18n layer remains Wave 6.

Full Jest passed 80 suites/669 tests; typecheck passed; lint passed with zero errors and the same 19 existing warnings. Maestro flows now assert chat avatars, the customer day divider/read marker, and both notification centers. No native device is attached, so visual phone review remains open; Expo Go's running Metro server is still available. Mapbox remains blocked by missing `EXPO_PUBLIC_MAPBOX_TOKEN` in local `.env` and every EAS environment; the EAS native download secret is present. Explore's native map also intentionally cannot load in Expo Go and requires the custom dev build.

Mapbox empty-state follow-up: Expo Go now explains that the native map requires the Privelier development build, and a native build without the public runtime token shows a clear setup state instead of an unconfigured blank map. Geocoding already reports the missing-token state. A working token still needs to be configured before either address search or map tiles can be verified.

Notification access follow-up: the live unread badge is now reusable and appears on Customer Discover and Account, and Barber Studio. It counts unread own rows, updates over Realtime, and reloads when the app returns to the foreground; the badge caps visually at `99+` while the full count stays available to assistive technology.

### Customer Discover refresh item

Discover now offers a brass-toned pull to refresh and keeps its last confirmed barber directory visible while a new read runs. A network error appears as a retry notice above the retained directory. If the customer removes their city, the old city label and results clear before the profile action appears. The first visit still uses layout-shaped skeletons; the personal name stays a neutral shape until the real profile arrives. The discovery Maestro flow pulls to refresh before searching. Native gesture and visual checks remain open without a device.

Focused Jest passed 2 suites/6 tests; full Jest passed 73 suites/653 tests. Typecheck and lint passed with 19 pre-existing warnings.

### Shared toast item

A root-level toast now provides one quiet, hairline-bordered feedback surface to both apps. It fades in using the system Reduce Motion setting, announces its message politely, and supports an optional labeled 44pt action. Showing a later message replaces the earlier one and resets its dismissal timer. The 5-second cancellation undo flow will use this shared primitive in its own booking item; no cancellation behavior changed here. Focused Jest passed 1 suite/2 tests. Native visual checks remain open without a device.

Full Jest passed 74 suites/655 tests. Typecheck and lint passed with 19 pre-existing warnings.

### Customer cancellation undo item

After confirmation, Customer Bookings leaves the real booking status untouched for five seconds and displays a quiet pending line plus an Undo toast action. Undo sends no cancellation. Expiry, explicit dismissal, or replacement closes the window and starts the existing RLS-backed cancellation mutation; a server rejection restores the row and refreshes its authoritative state. No booking state or payment flow changed. The customer cancellation Maestro flow creates a real booking and exercises Undo. The current native confirmation alert will move to the shared confirmation sheet in the remaining Wave 1 work. Focused Jest passed 2 suites/7 tests. Native behavior remains unverified without a device.

Full Jest passed 74 suites/657 tests. Typecheck and lint passed with 19 pre-existing warnings.

### Shared confirmation sheet item

The app root now provides gesture handling and a bottom-sheet portal. A reusable confirmation sheet uses the brand surface, hairline border and brass handle, with 52pt labeled choices, backdrop dismissal, pan-down dismissal, keyboard handling and the OS Reduce Motion setting. Customer booking cancellation now opens this sheet before its five-second undo window; the native alert is removed from that flow. The cancellation Maestro flow targets the sheet's confirm action. Focused component and booking tests passed. Full Jest passed 75 suites/658 tests; typecheck and lint passed with 19 pre-existing warnings. Native sheet gestures, keyboard movement and visual appearance remain unverified without a device.

### Customer and Barber tab feedback item

Both tab bars now use a shared 44pt tab button with a light selection haptic, explicit accessible labels and a subtle brass underline that animates beneath the selected icon. Real unread badges remain attached to Inbox and Chats. Reduced Motion shortens the underline to a simple opacity change. Customer and Barber Maestro flows now exercise tab navigation. Focused Jest passed 1 suite/2 tests; full Jest passed 76 suites/660 tests. Typecheck and lint passed with 19 pre-existing warnings. Native haptic and indicator behavior remains unverified without a device. The indicator appears under each selected icon; a single indicator that travels across the full bar remains open.
