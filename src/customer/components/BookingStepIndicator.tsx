/**
 * BookingStepIndicator — the "•••  Step N of 3" marker shared by the three
 * booking-flow step screens (DateTime / Location / Confirm), which each carried
 * a byte-identical copy of this markup + styles. Real triplication, extracted
 * in the Step-18 Ultra pass (increment 5); it rides each screen's
 * ScreenBackHeader `right` slot. No testIDs (the dots are decorative).
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';

export function BookingStepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[styles.dot, { backgroundColor: n <= current ? colors.accent : colors.border }]}
          />
        ))}
      </View>
      <Text style={[styles.step, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {`Step ${current} of 3`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dots: { flexDirection: 'row', gap: space.xs },
  dot: { width: 12, height: 3, borderRadius: 2 },
  step: { fontSize: 12, letterSpacing: 0.5 },
});
