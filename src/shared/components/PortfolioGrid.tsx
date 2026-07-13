/**
 * PortfolioGrid — the shared two-column layout container for portfolio tiles.
 *
 * An "ultra component" in the CalendarDateStrip lineage: pure layout, no data,
 * no theme colour. It owns exactly one thing — the row/wrap/gap flow and the
 * two-column tile-width contract — and exports `portfolioTileStyle` so every
 * tile that lives in this flow (the shared PortfolioTile, plus the barber-only
 * add/uploading tiles that stay in PortfolioScreen) lines up on the same grid.
 *
 * Consumed by both apps: the barber's own editable grid (PortfolioScreen) and
 * the customer's read-only Portfolio tab (BarberProfileScreen).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export function PortfolioGrid({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // The two-column tile-width contract. `flexGrow:1` lets a lone tile in a row
  // fill the width; `47%` (not 48%) leaves headroom for the 12px gap without
  // the fragile maxWidth clamp the old inline style needed. Radius 6 is the
  // house standard for all four tile types (real/add/uploading/empty).
  tile: { width: '47%', flexGrow: 1, aspectRatio: 1, borderRadius: 6, overflow: 'hidden' },
});

/** Shared tile-width style so add/uploading tiles align with real tiles. */
export const portfolioTileStyle = styles.tile;
