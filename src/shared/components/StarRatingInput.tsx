/**
 * StarRatingInput — interactive 1–5 star picker (build-order step 18, reviews).
 *
 * The app's first rating INPUT (design C9). Used by the customer
 * ReviewSubmitScreen. Each star is an independent touch target: tapping star N
 * sets the value to N (there is no half-star, matching the display component
 * and the DB CHECK of 1–5). Tapping the currently-selected star does NOT clear
 * to 0 — a review requires a rating, so once set it can only move between 1
 * and 5; the submit button stays gated on value > 0 by the caller.
 *
 * Accessibility: the group is an adjustable control announcing the current
 * value AND responding to increment/decrement adjust actions (the fast
 * VoiceOver/TalkBack gesture path), while each star stays a direct-tap button
 * with an explicit label. Targets are padded to a comfortable size regardless
 * of the glyph `size`.
 */
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

const STARS = [1, 2, 3, 4, 5] as const;

export function StarRatingInput({
  value,
  onChange,
  // Do NOT drop below 34: with padding:4 that keeps each star's touch target at
  // the 44px WCAG 2.5.8 floor (34 + 4*2 + hitSlop). 36 is the design default.
  size = 36,
  disabled = false,
  testID,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.row, disabled ? styles.rowDisabled : null]}
      accessibilityRole="adjustable"
      accessibilityLabel="Your rating"
      accessibilityValue={{ text: value > 0 ? `${value} out of 5 stars` : 'No rating selected' }}
      accessibilityActions={disabled ? undefined : [{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (disabled) return;
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(5, value + 1));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(1, value - 1));
      }}
      testID={testID}
    >
      {STARS.map((n) => {
        const active = n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${n} ${n === 1 ? 'star' : 'stars'}`}
            accessibilityState={{ selected: active, disabled }}
            hitSlop={6}
            testID={testID ? `${testID}-star-${n}` : undefined}
            // A tight scale settle (no bounce/spring) matches the house press
            // language (CalendarDateStrip) and gives the first rating input a
            // considered moment without a muddy full-opacity fade.
            style={({ pressed }) => [styles.star, { transform: [{ scale: pressed ? 0.88 : 1 }] }]}
          >
            <Ionicons
              name={active ? 'star' : 'star-outline'}
              size={size}
              // Empty stars use the secondary text tone, not the (much dimmer)
              // hairline border colour the read-only StarRating uses: on an
              // interactive picker all five must clearly read as tappable.
              color={active ? colors.accent : colors.textSecondary}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDisabled: { opacity: 0.5 },
  star: { padding: 4 },
});
