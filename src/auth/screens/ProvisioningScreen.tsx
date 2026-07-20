/**
 * PROVISIONING (Contract A state 4), loading + failure views. This is the
 * NORMAL first-login state for every new user while ensureProfile() runs —
 * kept lightweight and brand-calm. The 'setup_form' view is a separate
 * screen (FinishSetupScreen).
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthFailure } from '../errors';
import { useTheme } from '../../theme/useTheme';
import Brandmark from '../../shared/components/Brandmark';
import { PrimaryButton, TextLink } from './ui';

interface Props {
  view: { kind: 'loading' } | { kind: 'failure'; failure: AuthFailure };
  onRetry: () => void;
  onSignOut: () => void;
}

export default function ProvisioningScreen({ view, onRetry, onSignOut }: Props) {
  const { colors, fonts } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="provisioning-screen"
    >
      {view.kind === 'loading' ? (
        <View style={styles.center} testID="provisioning-loading">
          {/* The normal first-login wait for every new user, in both apps —
              a branded silence with nothing else on screen, which is exactly
              where a seal belongs. Deliberately NOT animated: the spinner
              already says "working"; a breathing logo would say "startup". */}
          <Brandmark size="md" style={styles.markSpacing} />
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            Setting up your account
          </Text>
        </View>
      ) : (
        <View style={styles.center} testID="provisioning-failure">
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
            We couldn&rsquo;t finish setting up
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {view.failure.message}
          </Text>
          <View style={styles.actions}>
            <PrimaryButton label="Try again" onPress={onRetry} testID="provisioning-retry" />
            <TextLink label="Log out" onPress={onSignOut} testID="provisioning-sign-out" />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  center: { alignItems: 'center', gap: 12 },
  // The container's gap is 12; the mark wants a little more air beneath it
  // than the spinner-to-caption rhythm.
  markSpacing: { marginBottom: 8 },
  loadingText: { fontSize: 14 },
  title: { fontSize: 24, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
});
