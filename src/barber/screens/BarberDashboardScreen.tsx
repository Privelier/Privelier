import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { useExitRole } from '../../RoleContext';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'BarberDashboard'>;

export default function BarberDashboardScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  // In authenticated states the exit action is a real sign-out (Contract A).
  const onSignOut = useExitRole();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
        Barber app
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        Manage your services and availability, and bookings land here next.
      </Text>
      <View style={styles.menu}>
        <Pressable
          onPress={() => navigation.navigate('Services')}
          accessibilityRole="button"
          accessibilityLabel="Manage services"
          testID="barber-dashboard-services"
          style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.menuItemText, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
            Services
          </Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Availability')}
          accessibilityRole="button"
          accessibilityLabel="Manage availability"
          testID="barber-dashboard-availability"
          style={[styles.menuItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.menuItemText, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
            Availability
          </Text>
        </Pressable>
      </View>
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
  menu: { width: '100%', gap: 12, marginBottom: 24 },
  menuItem: { borderWidth: 0.5, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  menuItemText: { fontSize: 15 },
  back: { fontSize: 14 },
});
