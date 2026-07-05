import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { useExitRole } from '../../RoleContext';

export default function BarberDashboardScreen() {
  const { colors, fonts } = useTheme();
  // In authenticated states the exit action is a real sign-out (Contract A).
  const onSignOut = useExitRole();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
        Barber app
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        Services, availability, and bookings land here next.
      </Text>
      <Pressable
        onPress={onSignOut}
        accessibilityRole="button"
        accessibilityLabel="Log out"
        hitSlop={16}
        testID="barber-dashboard-logout"
      >
        <Text style={[styles.back, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
          Log out
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
