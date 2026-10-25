import { Platform } from 'react-native';

/**
 * Render-window tuning shared by the app's long lists: render about one
 * screen up front, keep a modest window around the viewport, and detach
 * off-screen rows on Android (where it measurably cuts memory and frame
 * time; on iOS it can blank rows during fast flings, so it stays off).
 */
export const listPerformance = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 6,
  windowSize: 7,
  updateCellsBatchingPeriod: 40,
  removeClippedSubviews: Platform.OS === 'android',
} as const;
