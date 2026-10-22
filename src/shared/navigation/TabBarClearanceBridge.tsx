import { useContext, type ReactNode } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarHeightProvider, tabBarFloatGap } from './tabBarClearance';

/**
 * Tab-shell only: forwards the bottom-tabs bar height, plus the gap the
 * floating pill keeps above the home indicator, to useTabBarClearance.
 */
export function TabBarClearanceBridge({ children }: { children: ReactNode }) {
  const barHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const { bottom } = useSafeAreaInsets();
  return <TabBarHeightProvider height={barHeight ? barHeight + tabBarFloatGap(bottom) : 0}>{children}</TabBarHeightProvider>;
}
