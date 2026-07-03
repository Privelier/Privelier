# Mobile-developer retrospective review — Step 4 (role-select screen + navigators)

Reviewed at commit `8f6aa05` state. Scope: App.tsx, RoleSelectScreen.tsx, CustomerNavigator/BarberNavigator,
CustomerHomeScreen/BarberDashboardScreen, src/theme/*, package.json, app.json, tsconfig.json.

## Verdict

Solid for a step-4 placeholder. Stack/dependency versions (Expo 57, RN 0.86, React 19.2, React Navigation 7,
Hermes/Fabric on by default) are current and correctly wired — no engine/architecture issues. The
Customer/Barber navigation separation (CLAUDE.md's "must never share UI or navigation") holds up structurally
today: separate folders, separate ParamLists, separate Stack.Navigator instances, no cross-imports. The only
shared code is design tokens (`src/theme`) and the pre-role-selection shell (`App.tsx`, `RoleSelectScreen.tsx`),
which is the correct place for sharing — brand tokens aren't "UI/navigation" in the sense the rule means, and
role selection necessarily happens before a role-specific navigator exists.

One real bug-class issue (inline screen `children` render props) and a handful of small, cheap-to-fix
best-practice items. Nothing blocks moving to step 5.

## Priority 1 — fix now (cheap, prevents real bugs as screens are added)

### 1. Inline `children` render prop on `Stack.Screen` remounts the screen every navigator re-render
`src/customer/CustomerNavigator.tsx:13-15`, `src/barber/BarberNavigator.tsx:13-15`

```tsx
<Stack.Screen name="CustomerHome">
  {() => <CustomerHomeScreen onBack={onExit} />}
</Stack.Screen>
```

Passing a `children` function creates a brand-new component type on every render of `CustomerNavigator`. React
Navigation explicitly warns against this — it forces the screen to fully unmount/remount instead of just
re-rendering, which silently wipes local state (scroll position, form input, in-progress bookings, unread chat
drafts, etc.) any time the parent re-renders. It's invisible now (nothing above it re-renders), but this pattern
is exactly the kind of thing that produces intermittent state loss once the dashboard/booking screens are built
and something above them (auth context, theme, etc.) starts re-rendering more often.

**Fix — use React Context for the "exit role" action instead of prop-threading via `children`:**

```tsx
// src/RoleContext.tsx
import { createContext, useContext } from 'react';

const RoleExitContext = createContext<() => void>(() => {});
export const RoleExitProvider = RoleExitContext.Provider;
export const useExitRole = () => useContext(RoleExitContext);
```

```tsx
// CustomerNavigator.tsx
export default function CustomerNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}
```

```tsx
// CustomerHomeScreen.tsx
export default function CustomerHomeScreen() {
  const onBack = useExitRole();
  ...
}
```

This also removes prop-drilling once more screens are added deeper in each stack (only the ones that actually
need "go back to role select" call `useExitRole()`, no threading required), and lets `component={}` be used
everywhere, which React Navigation can optimize properly (lazy mounting, `React.memo` compatibility).

### 2. Missing accessibility props on interactive elements
`src/RoleSelectScreen.tsx:53-74` (`RoleOption` Pressable), `CustomerHomeScreen.tsx:16-20` and
`BarberDashboardScreen.tsx:16-20` (back-link Pressable)

None of the `Pressable`s declare `accessibilityRole`/`accessibilityLabel`, and the back link is bare text with
no `hitSlop`, so its touch target is well under the ~44x44pt minimum. Fix:

```tsx
<Pressable
  onPress={onPress}
  accessibilityRole="button"
  accessibilityLabel={label}
  ...
>
```

```tsx
<Pressable onPress={onBack} accessibilityRole="button" hitSlop={12}>
  <Text ...>Not you? Go back</Text>
</Pressable>
```

### 3. No `testID`s on the role-select buttons
`src/RoleSelectScreen.tsx:53` (`RoleOption`)

CLAUDE.md mandates the `maestro-mobile-testing` skill for E2E, and this role-select screen is the very first
screen every E2E flow will pass through. Add `testID="role-select-customer"` / `testID="role-select-barber"`
now, while there are only two buttons, rather than retrofitting test IDs later across a larger screen tree.

### 4. Duplicated `Role` type
`App.tsx:12` (`type Role = 'customer' | 'barber' | null;`) vs `RoleSelectScreen.tsx:5`
(`type Role = 'customer' | 'barber';`)

Two independently-maintained definitions of the same concept. Low risk today, but if a role is ever added
(unlikely per CLAUDE.md, but even an internal state like `'customer' | 'barber' | 'unverified-barber'`) it's easy
to update one and forget the other. Extract to a single shared type (e.g. export `Role` from
`RoleSelectScreen.tsx` and import it in `App.tsx`, or put it in a small `src/types.ts`).

## Priority 2 — worth doing soon, not urgent

### 5. No tooling guardrail enforcing the customer/barber UI separation
No ESLint config exists anywhere in the repo root (checked for `.eslintrc*`/`eslint.config.*` — none). The
"Customer app and Barber app must never share UI or navigation" rule in CLAUDE.md is currently upheld only by
convention. Once more agents/pipeline runs start adding screens under `src/customer/**` and `src/barber/**`,
nothing stops an accidental `import ... from '../../barber/screens/...'` inside a customer screen. Recommend
adding ESLint with an import-boundary rule (e.g. `eslint-plugin-boundaries` or a simple
`no-restricted-imports` pattern rule) before step 7 adds real screens on both sides.

### 6. Role selection isn't persisted
`AsyncStorage` is already a dependency (`package.json:8`) but unused. Right now every reload forces the user
back to the role-select screen. This is fine as a placeholder — real auth (step 5) will replace this with
session-based routing (a logged-in barber shouldn't see role-select at all) — just flagging so no one invests
further in persisting this particular piece of state; treat it as throwaway once auth lands.

### 7. Unused font weight loaded at startup
`src/theme/typography.ts:1-10`: `PlayfairDisplay_600SemiBold` / `fontFamily.headingSemiBold` is loaded via
`useFonts` but not referenced by any screen yet (only `heading`, `body`, `bodyMedium`, `bodySemiBold` are used).
Small cost today, but `useFonts` blocks the splash screen until every listed font is loaded — worth pruning to
only actively-used weights as more get added, rather than loading speculatively.

### 8. `android.predictiveBackGestureEnabled: false` in `app.json:19`
CLAUDE.md targets Android 15+, where predictive back is now standard system UX and React Navigation v7's
native-stack supports it. This is disabled (likely an Expo template default rather than a deliberate choice).
Worth a deliberate test-and-enable pass rather than leaving it off indefinitely.

### 9. Adaptive icon background color doesn't match brand
`app.json:14` (`"backgroundColor": "#E6F4FE"`) is Expo's default template blue, not the brand palette
(`#BFA06B` accent / `#121214` dark bg). Not a code issue, just an asset placeholder — flagging since brand
identity is authoritative and the app icon is the first brand touchpoint a user sees.

## Not flagged (checked, no issue)

- Hermes/New Architecture: on by default for Expo 57 + RN 0.86, nothing to configure.
- `SplashScreen.preventAutoHideAsync()` + `onLayoutRootView` pattern in `App.tsx`: matches the documented Expo
  pattern correctly.
- `RoleOption` is defined at module scope in `RoleSelectScreen.tsx`, not redefined per render — fine.
- No unnecessary re-renders detected in the current 2-screen surface area.
