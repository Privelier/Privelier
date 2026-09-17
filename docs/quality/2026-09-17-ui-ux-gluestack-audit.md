# Privelier UI/UX and Gluestack audit — 2026-09-17

## Scope and confidence

Review only: Customer, Barber, shared authentication, navigation, presentation primitives, branding assets, and the data paths that determine visible state. No app code, packages, backend, or production data changed. Existing uncommitted branding work was included in the review and preserved.

Evidence labels: **observed** means inspected in source or measured from an asset, not tested on a phone; **inferred** means a likely runtime consequence; **not present** means absent from the inspected route/component inventory; **not tested** means no execution evidence. No connected devices or simulators were returned by the mobile tool. No authenticated visual walkthrough, VoiceOver/TalkBack, network simulation, native build, or performance measurement was performed. Sol 5.6 Ultra cannot be selected here; specialist agents/legacy slash commands were unavailable, so review lenses were applied manually. This report does not certify perfection, accessibility conformance, or release readiness.

## Complete screen/journey coverage map

All rows were inspected in source; all native execution remains **not tested**. Paths below are relative to the repository root. Loading/error/recovery behavior is described only where evidenced.

| Surface / source | Evidence and upgrade |
|---|---|
| Launch: `App.tsx`, `src/auth/useAuthShell.ts` | Observed font/session gating and stable role switch. Font-load error is not surfaced; indefinite splash is an inferred failure risk. |
| Role entry: `src/RoleSelectScreen.tsx` | Observed separate customer/barber entry choices. Wordmark canvas defect; small-screen/large-text fit untested. |
| Auth choice: `src/auth/screens/AuthEntryScreen.tsx` | Observed role-specific copy and login/signup navigation. Consider reducing the extra choice step only after usability testing. |
| Login: `src/auth/screens/LoginScreen.tsx` | Observed validation, password visibility, loading, provider buttons, unconfirmed-email routing. Password recovery not present. |
| Signup: `src/auth/screens/SignupScreen.tsx` | Observed inline errors, optional fields, duplicate-email recovery and barber verification note. Long form; optional fields could move to later setup. |
| Email confirmation: `src/auth/screens/AwaitEmailConfirmationScreen.tsx`, `src/auth/deepLink.ts` | Observed resend success/failure. Callback failures are returned but discarded by the root hook; expired-link guidance missing at that handoff. |
| Finish setup: `src/auth/screens/FinishSetupScreen.tsx` | Observed required role/name/city and retained form on failure. Only this state gets a forced-dark Gluestack provider. |
| Provisioning: `src/auth/screens/ProvisioningScreen.tsx` | Observed loading, retry, sign-out escape. Preserve these recovery actions. |
| Session expiry / sign-out: `src/auth/useAuthShell.ts`, `src/auth/authService.ts` | Observed session-driven routing and local sign-out fallback. Expiry during entry/payment-free booking/chat and unsaved-data behavior need device tests. |
| Admin: `src/auth/screens/AdminNotSupportedScreen.tsx` | Observed dashboard explanation and sign-out; separate mobile admin UI appropriately absent. |
| Discover: `src/customer/screens/DiscoverScreen.tsx` | Observed city lookup, search, service chips, skeleton, errors and empty states. Missing city-edit/retry actions; unsupported editorial claims. |
| Explore: `src/customer/screens/ExploreScreen.tsx`, `src/customer/exploreData.ts` | Observed mutually exclusive filters and list/map fallback. Available-today filter does not prove remaining slots. |
| Map: `src/customer/components/ExploreMapView.tsx` | Observed approximate display coordinates, selectable pins and profile card. Keep list alternative; reduce-motion behavior and map failures untested. |
| Barber profile: `src/customer/screens/BarberProfileScreen.tsx` | Observed services/portfolio/reviews, real empty/error states and book action. Add verification explanation, image enlargement and retry actions. |
| Date/time: `src/customer/screens/BookingDateTimeScreen.tsx` | Observed 14-day strip, period groups, selection invalidation on refresh. Failed busy reads become empty occupancy; highest-priority correction. |
| Address: `src/customer/screens/BookingLocationScreen.tsx` | Observed free-text city prefill and nonempty-only validation. No keyboard-avoiding/scroll container; address completeness and footer safety need correction. |
| Review/request: `src/customer/screens/BookingConfirmScreen.tsx` | Observed summary, conflict path, server-success transition. Price estimate may differ from server snapshot; duration omitted, address truncated, 700ms success dwell. |
| Booking history/cancellation: `src/customer/screens/BookingsScreen.tsx` | Observed upcoming/past, live updates, cancellation confirmation, rollback and review entry. Add connection/error recovery and direct booking-to-chat context. |
| Review submission: `src/customer/screens/ReviewSubmitScreen.tsx` | Observed required rating, optional comment, duplicate-review notice, keyboard avoidance. 700ms success state and comment accessibility need review. |
| Customer inbox: `src/customer/screens/InboxScreen.tsx` | Observed unread markers, real previews, focus fetch and empty/error states. Previews refresh on focus, not each arriving message. |
| Customer conversation: `src/customer/screens/ConversationScreen.tsx` | Observed pending/failed/retry, typing, read receipts and reconnect merge. Connection health hidden; draft/failed queue lifetime tied to mounted screen. |
| Customer account: `src/customer/screens/AccountScreen.tsx` | Observed profile display and sign-out. Fetch failures silently look like a generic Member; profile/city editing absent. |
| Account subsections: `src/customer/screens/AccountSectionScreen.tsx` | Observed favorites/notifications/privacy/preferences placeholders; help email is plain text. Replace dead-end expectations with supported actions/content. |
| Barber studio: `src/barber/screens/StudioScreen.tsx` | Observed real overview, readiness checklist, management navigation and focus refresh. Preserve these useful patterns; strengthen next appointment priority. |
| Barber requests: `src/barber/screens/RequestsScreen.tsx` | Observed accept/reject/complete/cancel, optimistic transitions and rollback. Long mixed-status list, one-line address, no detail/chat action. |
| Services: `src/barber/screens/ServicesScreen.tsx` | Observed add/edit/delete and inline form errors. Form sits above list; edit focus/scroll, dirty-exit protection and keyboard handling need improvement. |
| Availability: `src/barber/screens/AvailabilityScreen.tsx` | Observed weekly/date modes and CRUD. Raw date/time entry, no weekly visual overview; same editor recovery gaps. |
| Bio: `src/barber/screens/BioEditScreen.tsx` | Observed length counter, dirty-exit confirmation, keyboard avoidance and save return. Preserve; add retry for load failure. |
| Base location: `src/barber/screens/LocationEditScreen.tsx` | Observed debounced suggestions, stale-response guard, dirty-exit confirmation and save. Explain base area vs customer appointment address clearly. |
| Portfolio: `src/barber/screens/PortfolioScreen.tsx` | Observed six-image limit, upload preview/busy guard, delete confirmation/rollback and permission message. Add full-size preview and actionable denied-permission recovery. |
| Verification: `src/barber/screens/VerifyScreen.tsx` | Observed private/manual-review copy, two uploads and status. Mount-only refresh; document-fetch failure looks like no uploads; declined state says contact us without action. |
| Barber chats: `src/barber/screens/ChatsScreen.tsx` | Observed service-based titles and unread state. Same-service conversations are hard to distinguish until opened; previews refresh on focus. |
| Barber conversation: `src/barber/screens/ConversationScreen.tsx` | Observed customer-name enrichment and equivalent message recovery primitives. Same connection/draft limitations as Customer. |
| Cross-role seams | Booking/request mutations merge authoritative rows; conversations reconcile sent messages and receipts. Live two-device correctness not tested; do not infer it from comments or historical test results. |
| Notifications / booking deep links | Not present in inspected navigation; push remains deferred. Auth callback handling is present. |

## Prioritized findings, ownership and acceptance

### P1 — Correct before calling the core experience ready

1. **Booking availability can look free after a failed busy lookup.** `BookingDateTimeScreen.tsx:127` substitutes `[]` for failed busy reads. `exploreData.ts:82` checks date/day membership without remaining-time, occupancy or service-duration validation. Owner: engineering + booking UI. Fail closed per affected date, provide Retry, and label discovery availability according to what was actually checked. Acceptance: failed busy query shows no unverified selectable slots; a fully booked or elapsed day is not represented as bookable today.

2. **Address collection accepts only a city.** `BookingLocationScreen.tsx:38` prefills city; line 49 accepts any nonempty string. Collect explicit street/building and city with optional apartment/access instructions, composing the existing location field if appropriate. Explain address sharing using the actual authorized policy; do not promise delayed disclosure without backend support. Owner: booking UI + engineering validation. Acceptance: city-only cannot proceed; complete address remains readable at confirmation and by the authorized barber.

3. **Authentication recovery is incomplete.** No recovery route/API call found. `useAuthShell.ts` discards `applyAuthCallbackUrl` outcomes, including expired links. Signup/login also lack first-invalid-field focus. Owner: auth engineering + UI. Acceptance: forgotten password and expired confirmation link each have an actionable path; OAuth cancellation/failure returns to a useful state; provider and email submissions cannot overlap. Backend/provider readiness was not verified.

4. **Library theme/provider integration is inconsistent.** `App.tsx:51` wraps only FinishSetup with `mode="dark"`; provider calls global `Appearance.setColorScheme` without restoration. Other UI uses `useTheme`; `global.css` contains a separate generic palette. Owner: UI infrastructure. Acceptance: a single provider/theme policy serves both independent navigators, follows the intended appearance setting, and gives overlays the same Privelier tokens. Test light → setup → authenticated transitions.

5. **Current wordmark assets are badly framed.** White raster is 1600×900 but visible alpha bounds are only (469,427)–(887,473), about 26% of width. At the component's 280-point xl size, visible lettering is about 73×8 points; md is about 42×5. Black artwork has different offsets. Splash visible artwork occupies roughly 52 points of a 200-point image width. These are measured source-geometry consequences, not device screenshots. Owner: branding/UI. Crop transparent canvas around unchanged SVG paths, normalize placement and produce platform-specific icon canvases. Acceptance: both themes align, lettering remains unchanged, square icon masks and launcher-size readability are checked. Earlier completion wording overstated the quality of this change.

6. **Error states often lack recovery, and stale content hides failure.** Discover/Explore/profile show messages without direct retry. Bookings/Requests/conversations suppress load errors once rows exist. Realtime hooks log health issues but return no visible connection state. Owner: each journey, engineering connection contract. Acceptance: initial failure has Retry; stale content stays visible with an honest update warning and recovery action.

7. **Account promises exceed implemented capability.** AccountSection contains placeholder settings, favorites implies a save feature, help is plain email text; city editing is absent despite discovery directing users to add a city. Owner: customer account. Acceptance: edit city works, failed profile fetch is distinguishable from missing data, support opens a supported contact action, unavailable features do not masquerade as working settings. Do not add deferred notifications to resolve a placeholder.

8. **Verification can display stale or false document state.** `VerifyScreen.tsx:91` maps request-fetch failure to null, rendered as Not uploaded; effect at line 94 runs on mount, not tab refocus. Pending also precedes completed document submission. Owner: verification UI + engineering. Acceptance: distinguish missing documents, failed lookup, awaiting review and declined; refresh status on re-entry; expose real support/resubmission guidance without inventing review SLAs.

9. **Unsupported discovery claims weaken trust.** Discover chooses `filtered[0]` as featured and BarberCard labels it Editor's pick; Trending this week uses static images. Search promises styles but only matches barber/service names. Owner: discovery UI. Acceptance: use accurate editorial wording or real curated data; search copy matches its implemented scope.

### P2 — Usability and presentation upgrades

10. **Booking review and outcome:** add duration, full address, explicit edit actions, accurate request/pending language and authoritative saved price. `BookingConfirmScreen.tsx:106` promises confirmation shortly without evidence. Replace 700ms-only success feedback with a readable persistent destination or explicit next action. Owner: booking. Test changed service price and long addresses; retain DB price snapshot authority.

11. **Barber work organization:** put pending requests and today's accepted appointments ahead of history; provide full booking details and a direct conversation action. Mark-complete deserves a context-rich confirmation because completion is irreversible. Services/availability editing should bring the active form into view and protect dirty input. Owner: barber UI. Test long lists, duplicate service names, keyboard and back gestures.

12. **Availability entry:** use constrained date/time selection and a compact weekly overview; retain existing server rules and specific-date semantics. Owner: availability. Acceptance: users can add/edit an interval without typing formatting syntax; conflicts and invalid end times have actionable errors. Calendar is only presentation, not scheduling logic.

13. **Chat continuity:** update inbox previews while the list is open, identify barber-side threads by customer plus appointment context, and preserve or explicitly guard unsent drafts/failed sends when leaving. Queue uses screen-local state; leaving/re-entering loses unsubmitted state after unmount. Owner: chat. Test offline send → leave → return, duplicate taps and reconnect; avoid adding attachments/AI chat.

14. **Accessibility/adaptation:** tab labels are 10 points, status/time metadata often 10–12; large-name/address truncation is common. BarberCard's explicit accessible label omits visible rating/price. Skeleton and map dock animations do not inspect reduced-motion preferences. Booking footers exclude bottom safe-area edges and use fixed padding; location has no keyboard-avoiding wrapper. Owner: UI/accessibility. Acceptance: both themes, 200% text, small iOS/Android screens, screen readers and reduced motion; 44-point effective targets; all critical content/actions remain reachable. These are risks/pattern findings, not a claim that every small label or target fails a standard.

15. **Media and finishing:** PortfolioTile has no enlargement action or failed-image fallback; other avatars mostly handle missing URL rather than image-load failure. Add accessible full-image preview and useful upload/permission recovery. Use short saved confirmations for service/bio/location updates; keep consequential errors persistent. Owner: portfolio/shared primitives.

## Gluestack recommendation

Installed locally: core **5.0.0-alpha.0**, utils **5.0.1-alpha.0**, NativeWind **5.0.0-preview.2**, Expo **57.0.22**, React Native **0.86.3**. Only Button/Input are imported into app auth UI; local Alert/Card/FormControl wrappers also exist. This is partial adoption, not a finished design-system migration.

Current official migration docs recommend newer core/utils versions and NativeWind preview.4. Treat alignment as a dedicated infrastructure trial; this audit did not establish drop-in compatibility, bundle cost, license review, or native accessibility for a migration. AGENTS.md still makes HeroUI Native the first candidate for new suitable primitives. Exploring Gluestack does not itself supersede that policy. Reuse working components and compare only where a concrete gap exists.

| Candidate | Specific Privelier use | Priority / qualification |
|---|---|---|
| FormControl + Input + Textarea | One label/helper/required/error/disabled pattern across auth, addresses, services, bio and reviews | Highest; add field focus and validation logic separately |
| Alert + Button | Persistent failed/stale/offline states with Retry | Highest; existing Notice may already be the cheapest adapter |
| Actionsheet + Radio/Checkbox/Select | Explore filters and constrained selections with Apply/reset | High; keep filter state truthful, test keyboard/focus and dismissal |
| AlertDialog | Booking cancellation/completion, image deletion, discard edits | High where context is needed; working native alerts need no blanket replacement |
| Toast | Service saved, bio saved, location saved | Medium; never the sole place for a booking error or failed upload |
| Badge + Avatar | Consistent request status, verification explanation and fallback identity | Medium; display only backend-supported truth |
| Progress | Profile setup checklist progression | Medium; real completed steps only, no invented upload percentages |
| Accordion | Optional setup fields, help and document requirements | Medium; don't hide essential price/address/actions |
| Modal | Full portfolio preview with explicit close and accessible focus | Medium; validate native image gestures separately |
| Calendar / DateTimePicker | Barber interval entry, optional future booking picker | Evaluate; official catalog marks alpha |
| BottomSheet / Image Viewer / Skeleton / Tabs | Possible future implementations | Catalog marks alpha; retain working custom/navigation components until justified |

Preserve the existing font families, exact wordmark lettering, restrained brass, flat surfaces and separate Customer/Barber navigation. Avoid a full component rewrite, glass/gradient styling, additional bottom navigation systems, or AI chat. Gluestack supplies primitives; it cannot correct booking truth, account recovery, permissions or business policy.

Official sources consulted:

- [Component catalog](https://v5.gluestack.io/ui/docs/components/all-components)
- [v5 migration and package guidance](https://v5.gluestack.io/ui/docs/guides/more/upgrade-to-v5)
- [Actionsheet API and focus controls](https://v5.gluestack.io/ui/docs/components/actionsheet)
- [FormControl](https://v5.gluestack.io/ui/docs/components/form-control)
- [AlertDialog](https://v5.gluestack.io/ui/docs/components/alert-dialog)
- [Toast](https://v5.gluestack.io/ui/docs/components/toast)

## Validation and scorecard

Graph check/query succeeded. Screen/routes, UI dependencies and source state branches inspected. Raster alpha bounds measured. Connected-device inventory: empty. Focused Jest attempt blocked before test execution: missing `jest/package.json` via jest-expo. Historical test claims are not current execution evidence. No app code was modified; no security gate or native release PASS is claimed.

Scores describe inspected evidence only: 0 absent/broken, 1 major blockers, 2 usable with material gaps, 3 verified target, 4 verified improvement. Journey completion **1** (recovery/account gaps); comprehension/recovery **1**; state truth **1** (availability/verification fallbacks); visual-system coherence **2**; component maintainability **2**. Accessibility, trust/privacy enforcement, adaptive native quality and measured performance **Unknown**. No overall numeric average or release PASS.

Recommended sequence: separate cycles for (1) UI infrastructure/theme, (2) wordmark framing, (3) auth recovery, (4) truthful booking availability/address/review, (5) actionable discovery/account, (6) verification recovery, (7) barber management, (8) chat continuity, with accessibility checks in each. Booking, chat and verification must remain separate pipeline runs. Engineering owns live-data/connection/security validation; UI owns presentation and interaction. Formal engineering implementation handoff and specialist security review have not been executed in this read-only audit.

Before release, run representative small/notched iOS and small/mainstream Android devices, both appearances, largest supported text, screen readers, keyboard, offline/reconnect, permission denial and two-device booking/chat. Include brief customer/barber task testing. Keep the existing Phase 2 dispute/refund-policy and in-home safety gaps explicitly open; this audit does not implement them.
