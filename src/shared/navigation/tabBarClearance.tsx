import { createContext, useContext, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { space } from '../../theme/spacing';

/** Height of the floating glass pill itself (icon + label + top padding). */
export const TAB_BAR_HEIGHT = 58;

/** Side margin between the pill and the screen edges. */
const TAB_BAR_SIDE_MARGIN = 12;

/** Gap under the pill on phones without a home indicator. */
const TAB_BAR_MIN_GAP = 10;

/**
 * Gap between the floating pill and the screen's bottom edge. On phones with
 * a home indicator the pill sits just above it (the indicator itself is only
 * the lowest ~13pt of the 34pt inset), so its rounded corners stay clear of
 * the screen's rounded corners instead of being clipped by them.
 */
export function tabBarFloatGap(bottomInset: number): number {
  return bottomInset > 0 ? Math.max(bottomInset - 12, TAB_BAR_MIN_GAP) : TAB_BAR_MIN_GAP;
}

/**
 * Shared tabBarStyle for both tab shells. Pair it with
 * `safeAreaInsets={{ bottom: 0 }}` on the navigator: by default bottom-tabs
 * adds the home-indicator inset as padding inside the bar, which made the
 * floating pill 83pt tall with an empty band under the icons.
 */
export function useFloatingTabBarStyle(): ViewStyle {
  const { bottom = 0, left = 0, right = 0 } = useContext(SafeAreaInsetsContext) ?? {};
  return {
    // Floats over the screen (scroll content clears it with
    // useTabBarClearance), so the glass has content to frost.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TAB_BAR_HEIGHT,
    backgroundColor: 'transparent',
    marginLeft: TAB_BAR_SIDE_MARGIN + left,
    marginRight: TAB_BAR_SIDE_MARGIN + right,
    marginBottom: tabBarFloatGap(bottom),
    borderRadius: 24,
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: 0,
    elevation: 0,
  };
}

/**
 * The floating tab bar's measured height plus its float gap, bridged from the tab navigator
 * plus its float gap (see TabBarClearanceBridge in the tab shells). Kept in our own context so
 * screens never import the bottom-tabs navigator just to read a number.
 */
const TabBarHeightContext = createContext(0);

export function TabBarHeightProvider({ height, children }: { height: number; children: ReactNode }) {
  return <TabBarHeightContext.Provider value={height}>{children}</TabBarHeightContext.Provider>;
}

/**
 * Bottom padding a tab screen's scroll content needs so its last row can
 * scroll clear of the floating glass tab bar (the bar overlays content so
 * its blur has something to frost). Just `extra` outside a tab navigator,
 * so the same screen stays correct when pushed on a stack or rendered in
 * tests.
 */
export function useTabBarClearance(extra: number = space.base): number {
  const height = useContext(TabBarHeightContext);
  return height ? height + extra : extra;
}
