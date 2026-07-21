/**
 * StarRating — read-only 1–5 star display (build-order step 18, reviews).
 *
 * Shared by the customer BarberProfileScreen Reviews tab (per-review rows and
 * the aggregate header). Pure presentation: renders five glyphs, filled up to
 * the rounded rating, in brass; the remainder is a muted outline. Half-stars
 * are not drawn (rounded to nearest whole) — the numeric average is shown
 * alongside where precision matters, so the glyphs stay a calm at-a-glance
 * signal rather than a false-precision meter.
 *
 * A rating of 0 renders five empty outlines; callers that must distinguish
 * "new / no ratings" from "rated zero" (impossible — the CHECK is 1–5) handle
 * that copy themselves (see BarberCard's RatingLine / the profile header).
 *
 * Two opt-in props keep the shared default calm while letting the one prominent
 * instance (the aggregate header) read correctly (Ultra design pass 2026-07-21):
 * `emptyColor` lets a large instance use a more legible empty tone so the full
 * 5-point scale stays visible, and `importantForAccessibility` lets a header
 * that already announces "4.3, 12 reviews" hide this element's redundant
 * "Rated 4 out of 5" from screen readers.
 */
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

const STARS = [1, 2, 3, 4, 5] as const;

export function StarRating({
  rating,
  size = 14,
  emptyColor,
  style,
  importantForAccessibility,
  testID,
}: {
  rating: number;
  size?: number;
  /** Empty-star tone; defaults to the faint hairline colour (calm per-review rows). */
  emptyColor?: string;
  style?: StyleProp<ViewStyle>;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  testID?: string;
}) {
  const { colors } = useTheme();
  const filled = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <View
      // Larger glyphs need proportionally more air: 2px at per-review size,
      // 4px at the aggregate-header size so the row breathes beside the number.
      style={[styles.row, { gap: size >= 16 ? 4 : 2 }, style]}
      accessibilityRole="image"
      accessibilityLabel={`Rated ${filled} out of 5`}
      importantForAccessibility={importantForAccessibility}
      testID={testID}
    >
      {STARS.map((n) => (
        <Ionicons
          key={n}
          name={n <= filled ? 'star' : 'star-outline'}
          size={size}
          color={n <= filled ? colors.accent : emptyColor ?? colors.border}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
