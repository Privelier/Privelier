# Privelier UI/UX audit - 2026-09-12

## Scope and evidence

Reviewed the discoverable Customer and Barber routes, shared components, auth flow, navigation shells, booking flow, chat, verification, portfolio, account, and current theme tokens. Source evidence came from the route inventory and exact screen/component files. The running Expo web target was spot-checked at role selection, Customer auth, Customer signup, and Barber auth. Native visual/accessibility behavior was not tested because no Android device/emulator or iOS simulator is available.

## Priority findings

### P0 - resolve before calling the product complete

1. **The Explore tab exposes an unfinished map state.** `ExploreScreen` intentionally shows “The map arrives with the next app update” when the native Mapbox module is absent. That is honest, but it makes a primary customer tab feel broken. Either ship the Mapbox dev/release build and test it, or remove/hide the Map tab until it is useful. Acceptance: every claimed tab provides a useful action on a fresh supported build.

2. **Account settings contain dead-end placeholder destinations.** Favorites, Notifications, Privacy & security, and Preferences navigate successfully but mostly say the feature is coming later. This is structurally complete but behaviorally unfinished. Recommendation: keep only Help and real account/privacy controls until those features exist, or convert each placeholder into a useful read-only explanation with one concrete action.

3. **Booking location needs a trust and privacy moment.** The customer enters a full address, but the screen does not state when it becomes visible to the barber or what is shared. Add concise progressive-disclosure copy and a confirmation row: “Shared with this barber for this booking.” Do not promise safety or confidentiality beyond the actual access policy. Acceptance: the user understands the audience and purpose before confirming.

4. **The primary booking state needs a richer customer-facing status model.** The data layer supports pending, accepted, rejected, cancelled, and completed, but the booking card should consistently show the next action, duration, location visibility, and what happens next. A status label alone is not enough for a stranger-to-stranger service. Acceptance: every status has a clear owner, next action, and safe exit.

### P1 - high-value UX improvements

5. **Discovery has too many parallel concepts.** Discover contains search, service chips, a featured card, a nearby rail, and a static trending grid; Explore contains another filter system. Define one primary browse job: search/filter approved barbers, then move to profile. Keep editorial “Trending” only if it leads to a real barber/service result; otherwise it competes with the marketplace task.

6. **The first-run role choice is visually elegant but under-explains the consequence.** The two wide rows are clear, but the app should reassure users that the role controls their workspace and that barbers can complete manual verification after signup. This matters more for barber conversion than adding decoration.

7. **Forms need stronger mobile ergonomics than the web preview suggests.** The web spot-check renders large, sparse inputs and long vertical forms. On phones, verify keyboard avoidance, focus-to-error, dynamic type, password-manager/autofill behavior, and submit visibility. Signup should use a keyboard-aware scroll container and keep the primary action reachable after the last field.

8. **Alerts are overused for important workflows.** Delete confirmations and upload failures use platform alerts. Keep native alerts for destructive confirmation, but move recoverable upload/network/form feedback into the shared inline `Notice` pattern or a semantic status region so the user does not lose context.

9. **Barber requests need stronger comparison and decision support.** The request card should put date/time, duration, service, price snapshot, location disclosure, and the exact decision action in one scan path. Accept/reject/cancel/complete should visibly distinguish pending, server-confirmed, failed, and stale states.

10. **Chat composer is functionally strong but visually generic.** Add a compact attachment-free composer treatment: clearer focus state, send icon with accessible label, keyboard-safe bottom inset, and a more obvious failed-message retry affordance. Do not add attachments or presence unless those are separately scoped.

### P2 - polish after the journeys are solid

11. Normalize vertical rhythm and max content width on the web target. The current desktop preview stretches the two auth actions across nearly the entire viewport; a constrained reading width would feel more intentional without changing native phone layout.

12. Reduce repeated heading/subtitle patterns with a small semantic screen-header contract, while keeping Customer and Barber copy distinct.

13. Audit large text, TalkBack/VoiceOver order, selected tab announcements, contrast of muted text, and 44x44 touch targets on a real device. Static accessibility labels and unit tests cannot prove native reading order.

14. Keep the current flat palette and hairlines. The issue is not lack of decoration; it is hierarchy, task clarity, and state communication. Avoid adding gradients, shadows, or a second visual language.

## Recommended component plan

Build these project-owned semantic components before adding a large UI kit:

- `StatusTimeline` or `BookingStatusPanel`: pending/accepted/rejected/cancelled/completed, owner, next action, and server-confirmed timestamp.
- `AddressDisclosureRow`: destination, who can see it, and the booking context.
- `FilterSheet`: one reusable filter surface for Explore and future service filtering.
- `InlineActionNotice`: retry, choose another time, open settings, or contact support without losing screen context.
- `EmptyStateAction`: calm empty copy plus one relevant action, not a dead paragraph.
- `FormScreenShell`: safe-area, keyboard-aware scrolling, focus-to-first-error, and footer action behavior.
- `RequestDecisionBar`: explicit pending/loading/success/failure/stale states for Barber requests.

## Library recommendations

### Recommend one focused addition later

**`@gorhom/bottom-sheet`** is the best fit for filter sheets, booking detail actions, and non-destructive account panels. Its official documentation describes React Native Web support, dynamic sizing, keyboard handling, list integration, accessibility support, and React Navigation integration. It requires `react-native-reanimated` and `react-native-gesture-handler`, so it belongs in a dedicated UI-infrastructure pipeline and requires a development-build/native validation pass. Do not install it until the component contract is designed.

### Use existing or custom code for now

- **Calendar:** keep `CalendarDateStrip`; replacing it with `react-native-calendars` would duplicate a working branded control and risk visual drift.
- **Icons:** keep Expo Vector Icons/Feather and the current semantic wrappers.
- **Forms/notices/buttons:** keep the project-owned primitives and consider HeroUI Native only for a small validated primitive experiment, not a wholesale migration.
- **Lists:** keep `FlatList` at current MVP data sizes. Evaluate FlashList only after measured list/frame evidence.
- **Toasts:** do not add a toast package yet; inline notices are more truthful for booking and upload outcomes.

### Do not add as a general UI layer

React Native Paper, Tamagui, and gluestack-ui would introduce a broader component system while Privelier already has an authored token layer and semantic primitives. They may be valid for a future infrastructure decision, but they are not the smallest answer to the current UX gaps.

## Scorecard

| Dimension | Score | Evidence |
|---|---:|---|
| Journey completion | 2/4 | Core routes exist; Explore/account placeholders and native-only branches remain. |
| Comprehension and recovery | 2/4 | Error mapping is strong; booking/privacy and request next-action language need work. |
| Accessibility | 2/4 | Good labels/test IDs and semantic roles in source; no native AT verification. |
| State truth | 3/4 | Realtime and pending-send states are deliberately modeled; visual status hierarchy needs consistency. |
| Trust and privacy | 2/4 | Verification copy is careful; address disclosure timing needs to be explicit. |
| Visual coherence | 3/4 | Brand tokens, typography, flat surfaces, and separate shells are coherent. |
| Component maintainability | 3/4 | Shared primitives exist; add semantic workflow components before more styling. |

Overall: **usable MVP foundation, not yet a finished product experience**. Complete P0 journey clarity and native validation before the final visual refinement pass.
