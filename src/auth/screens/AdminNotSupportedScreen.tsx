/**
 * AUTHENTICATED with role 'admin' (Contract A state 5): the mobile app does
 * not serve admins — the founders use the Supabase dashboard. Terse by design.
 */
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { PrimaryButton } from './ui';

export default function AdminNotSupportedScreen({ onSignOut }: { onSignOut: () => void }) {
  const { colors, fonts } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="admin-screen"
    >
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
          Admin account
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          This account uses the admin dashboard. The app is for customers and barbers.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton label="Log out" onPress={onSignOut} testID="admin-sign-out" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  center: { alignItems: 'center', gap: 12 },
  title: { fontSize: 24, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  actions: { alignSelf: 'stretch' },
});
