import { useContext, type ReactNode } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { TabBarHeightProvider } from './tabBarClearance';

/** Tab-shell only: forwards the bottom-tabs bar height to useTabBarClearance. */
export function TabBarClearanceBridge({ children }: { children: ReactNode }) {
  return <TabBarHeightProvider height={useContext(BottomTabBarHeightContext) ?? 0}>{children}</TabBarHeightProvider>;
}
