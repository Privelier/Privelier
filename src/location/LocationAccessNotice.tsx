import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Notice, TextLink } from '../auth/screens/ui';
import { useTheme } from '../theme/useTheme';
import type { LocationEligibility } from './locationEligibility';

type BlockedReason = Exclude<LocationEligibility, { status: 'eligible' }>;

const messages: Record<BlockedReason['status'], string> = {
  permission_denied: 'Allow location while using Privelier to continue.',
  unavailable: 'We could not confirm your location. Check Location Services and your connection, then try again.',
  outside_service_area: 'Privelier is currently available only in Nuremberg, Germany. Try again when you arrive.',
};

export function LocationAccessNotice({ reason, testID }: { reason: BlockedReason; testID: string }) {
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

  return (
    <View style={styles.container}>
      <Notice kind="error" message={messages[reason.status]} testID={testID} />
      {reason.status !== 'outside_service_area' ? (
        <TextLink label="Open device settings" onPress={() => void openSettings()} testID={`${testID}-settings`} />
      ) : null}
      {settingsError ? (
        <Text style={[styles.settingsError, { color: colors.errorText, fontFamily: fonts.body }]}>
          Device settings could not be opened. Open them manually, then try again.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  settingsError: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
