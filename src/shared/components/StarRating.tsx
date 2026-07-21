/**
 * StarRating — read-only 1–5 star display (build-order step 18, reviews).
 *
 * Shared by the customer BarberProfileScreen Reviews tab (per-review and the
 * aggregate header). Pure presentation: renders five glyphs, filled up to the
 * rounded rating, in brass; the remainder is a muted outline. Half-stars are
 * not drawn (rounded to the nearest whole) — the numeric average is shown
 * alongside where precision matters, so the glyphs stay a calm at-a-glance
 * signal rather than a false-precision meter.
 *
 * A rating of 0 renders five empty outlines; callers that must distinguish
 * "new / no ratings" from "rated zero" (impossible — the CHECK is 1–5) handle
 * that copy themselves (see BarberCard's RatingLine / the profile header).
 */
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

const STARS = [1, 2, 3, 4, 5] as const;

export function StarRating({
  rating,
  size = 14,
  style,
  testID,
}: {
  rating: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const filled = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="image"
      accessibilityLabel={`Rated ${filled} out of 5`}
      testID={testID}
    >
      {STARS.map((n) => (
        <Ionicons
          key={n}
          name={n <= filled ? 'star' : 'star-outline'}
          size={size}
          color={n <= filled ? colors.accent : colors.border}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
