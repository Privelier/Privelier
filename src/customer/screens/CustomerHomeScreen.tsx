import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { useExitRole } from '../../RoleContext';

export default function CustomerHomeScreen() {
  const { colors, fonts } = useTheme();
  const onBack = useExitRole();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
        Customer app
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        Barber discovery and booking land here next.
      </Text>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Not you? Go back to role selection"
        hitSlop={12}
      >
        <Text style={[styles.back, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
          Not you? Go back
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  heading: { fontSize: 26 },
  body: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  back: { fontSize: 14 },
});
