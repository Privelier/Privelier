import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';

export default function BarberDashboardScreen({ onBack }: { onBack: () => void }) {
  const { colors, fonts } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
        Barber app
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        Services, availability, and bookings land here next.
      </Text>
      <Pressable onPress={onBack}>
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
