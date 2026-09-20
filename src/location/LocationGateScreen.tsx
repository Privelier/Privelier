import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Brandmark from '../shared/components/Brandmark';
import { PrimaryButton } from '../shared/components/PrimaryButton';
import { TextLink } from '../auth/screens/ui';
import { useTheme } from '../theme/useTheme';
import { space } from '../theme/spacing';
import type { LocationEligibility } from './locationEligibility';

type BlockedReason = Exclude<LocationEligibility, { status: 'eligible' }>;

interface Props {
  view: { kind: 'checking' } | { kind: 'blocked'; reason: BlockedReason };
  onRetry: () => void;
}

const blockedCopy: Record<BlockedReason['status'], { title: string; detail: string }> = {
  permission_denied: {
    title: 'Location access is off',
    detail: 'Allow location while using Privelier to confirm you are in Nuremberg.',
  },
  unavailable: {
    title: 'We could not confirm your location',
    detail: 'Check that Location Services are on and your connection is working, then try again.',
  },
  outside_service_area: {
    title: 'Privelier is in Nuremberg',
    detail: 'Bookings are currently available only in Nuremberg, Germany. Check again when you arrive.',
  },
};

export default function LocationGateScreen({ view, onRetry }: Props) {
  const { colors, fonts } = useTheme();
  const [settingsError, setSettingsError] = useState(false);
  const openSettings = useCallback(async () => {
    setSettingsError(false);
    try {
      await Linking.openSettings();
    } catch {
      setSettingsError(true);
    }
  }, []);

  const blocked = view.kind === 'blocked' ? blockedCopy[view.reason.status] : null;
  const showSettings = view.kind === 'blocked' && view.reason.status !== 'outside_service_area';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="location-gate-screen"
    >
      <View style={styles.content}>
        <Brandmark size="md" style={styles.brand} />
        <Feather name="map-pin" size={24} color={colors.accent} accessibilityElementsHidden />
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.heading }]}
          testID="location-gate-title"
        >
          {blocked?.title ?? 'Checking your location'}
        </Text>
        <Text style={[styles.detail, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {blocked?.detail ?? 'Privelier is available in Nuremberg, Germany.'}
        </Text>
        {view.kind === 'checking' ? (
          <ActivityIndicator size="small" color={colors.accent} testID="location-gate-checking" />
        ) : (
          <View style={styles.actions}>
            <PrimaryButton label="Check again" icon="refresh-cw" onPress={onRetry} testID="location-gate-retry" />
            {showSettings ? (
              <TextLink label="Open device settings" onPress={() => void openSettings()} testID="location-gate-settings" />
            ) : null}
            {settingsError ? (
              <Text style={[styles.settingsError, { color: colors.errorText, fontFamily: fonts.body }]}>
                Device settings could not be opened. Open them manually, then check again.
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  content: { alignItems: 'center' },
  brand: { marginBottom: space['2xl'] },
  title: { fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: space.lg },
  detail: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: space.sm, maxWidth: 340 },
  actions: { alignSelf: 'stretch', marginTop: space.xl, gap: space.md },
  settingsError: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
