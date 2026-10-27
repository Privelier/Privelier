/**
 * Shared UI primitives for the PRE-AUTH shell and provisioning screens only.
 * (CLAUDE.md allows sharing here — never inside src/customer or src/barber.)
 *
 * Brand rules applied: flat design, 0.5px borders, brass accent restricted to
 * the primary CTA and active states, sentence case copy, serif headings.
 *
 * Visual language: headings moved to the editorial medium-weight
 * serif, back navigation switched to the icon-circle button, and form inputs
 * switched from boxed fields to hairline-underline fields (brass on focus) —
 * matching the pattern already applied to Studio/Inbox/Account-section and
 * the barber Services/Availability screens.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { Notice as SharedNotice } from '../../shared/components/Notice';
import { BackButton } from '../../shared/components/ScreenBackHeader';

// PrimaryButton is now the shared canonical CTA — re-exported so existing auth
// call sites (label/onPress/testID/loading/disabled) are unchanged, and they
// inherit the shared behaviour (full opacity while loading, soft press dim).
export { PrimaryButton } from '../../shared/components/PrimaryButton';
// The text field and the secondary/link/OAuth buttons live in auth/components.
export { FormTextField } from '../components/FormTextField';
export { OAuthButton, SecondaryButton, TextLink } from '../components/AuthButtons';

// ---------------------------------------------------------------------------
// Screen shell — safe area + keyboard avoidance + tap-to-dismiss scroll
// ---------------------------------------------------------------------------

export function AuthScreenShell({ children, testID }: { children: ReactNode; testID: string }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      style={[shellStyles.safe, { backgroundColor: colors.background }]}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={shellStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={shellStyles.flex}
          contentContainerStyle={shellStyles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ScreenHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={shellStyles.heading}>
      <Text style={[shellStyles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[shellStyles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function BackLink({ onPress, testID }: { onPress: () => void; testID: string }) {
  // The shared BackButton, left-aligned. Geometry is byte-identical (36×36,
  // radius 18, surface, arrow-left 16, hitSlop 12) and it adds the pressed dim
  // the local disc lacked.
  return (
    <View style={shellStyles.backLink}>
      <BackButton onPress={onPress} testID={testID} tone="surface" />
    </View>
  );
}

const shellStyles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  heading: { marginTop: 24, marginBottom: 32 },
  title: { ...typeScale.title1, marginBottom: space.sm },
  subtitle: typeScale.bodyLarge,
  backLink: { alignSelf: 'flex-start' },
});

// ---------------------------------------------------------------------------
// Calm inline notice (error / success feedback)
// ---------------------------------------------------------------------------

/**
 * Thin shim over the shared Notice: preserves the auth `kind` API and the
 * built-in bottom margin (space.lg = 20) so no auth call site changes. The
 * shared component marks the `error` variant as an a11y alert, so error banners
 * keep announcing.
 */
export function Notice({
  kind,
  message,
  testID,
}: {
  kind: 'error' | 'success';
  message: string;
  testID: string;
}) {
  return <SharedNotice variant={kind} message={message} testID={testID} style={noticeShimStyle} />;
}

const noticeShimStyle = { marginBottom: space.lg } as const;
