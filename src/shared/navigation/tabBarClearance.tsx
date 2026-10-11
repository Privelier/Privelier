import { createContext, useContext, type ReactNode } from 'react';
import { space } from '../../theme/spacing';

/** Gap between the floating glass tab bar and the screen's bottom edge. */
export const TAB_BAR_FLOAT_GAP = 6;

/**
 * The floating tab bar's measured height, bridged from the tab navigator
 * (see TabBarClearanceBridge in the tab shells). Kept in our own context so
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
  return height ? height + TAB_BAR_FLOAT_GAP + extra : extra;
}
