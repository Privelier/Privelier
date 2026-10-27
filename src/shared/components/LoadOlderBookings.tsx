/**
 * List footer that loads the next page of older bookings. Shows the failure
 * reason above the button so a retry is a deliberate tap, never automatic.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { getAppLanguage } from '../locale';

export function LoadOlderBookings({ loading, error, onPress, testID }: {
  loading: boolean;
  error: string | null;
  onPress: () => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const label = de ? 'Ältere Termine anzeigen' : 'Show older bookings';
  return (
    <View style={styles.wrap}>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.errorText, fontFamily: fonts.body }]} testID={`${testID}-error`}>{error}</Text>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: loading, busy: loading }}
        testID={testID}
        style={({ pressed }) => [styles.button, { borderColor: colors.border, opacity: loading ? 0.6 : pressed ? pressOpacity.firm : 1 }]}
      >
        {loading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        <Text style={[styles.label, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  error: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
  },
  label: { fontSize: 14 },
});
