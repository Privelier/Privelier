/**
 * Shared UI primitives for the PRE-AUTH shell and provisioning screens only.
 * (CLAUDE.md allows sharing here — never inside src/customer or src/barber.)
 *
 * Brand rules applied: flat design, 0.5px borders, brass accent restricted to
 * the primary CTA and active states, sentence case copy, serif headings.
 *
 * Visual pass (2026-07-09): headings moved to the editorial medium-weight
 * serif, back navigation switched to the icon-circle button, and form inputs
 * switched from boxed fields to hairline-underline fields (brass on focus) —
 * matching the pattern already applied to Studio/Inbox/Account-section and
 * the barber Services/Availability screens. No behavior, validation, or
 * testID changed.
 */
import { useState, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, space } from '../../theme/spacing';
import { Notice as SharedNotice } from '../../shared/components/Notice';
import { BackButton } from '../../shared/components/ScreenBackHeader';

// PrimaryButton is now the shared canonical CTA — re-exported so existing auth
// call sites (label/onPress/testID/loading/disabled) are unchanged, and they
// inherit the shared behaviour (full opacity while loading, soft press dim).
export { PrimaryButton } from '../../shared/components/PrimaryButton';

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
  title: { fontSize: 30, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  backLink: { alignSelf: 'flex-start' },
});

// ---------------------------------------------------------------------------
// Text field with label, error, helper and secure show/hide toggle
// ---------------------------------------------------------------------------

interface FormTextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  testID: string;
  error?: string;
  helper?: string;
  optional?: boolean;
  secure?: boolean;
  multiline?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  // Focus-chaining: a screen forwards a ref and a submit handler so the
  // keyboard's next/go/done key advances the form without leaving the keyboard.
  inputRef?: Ref<TextInput>;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
}

export function FormTextField({
  label,
  value,
  onChangeText,
  testID,
  error,
  helper,
  optional = false,
  secure = false,
  multiline = false,
  autoCapitalize,
  keyboardType,
  autoComplete,
  textContentType,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
}: FormTextFieldProps) {
  const { colors, fonts } = useTheme();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);

  return (
    <View style={fieldStyles.field}>
      <View style={fieldStyles.labelRow}>
        <Text style={[fieldStyles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
          {label}
        </Text>
        {optional ? (
          <Text style={[fieldStyles.optional, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            optional
          </Text>
        ) : null}
      </View>
      <View
        style={[
          fieldStyles.inputRow,
          {
            borderBottomColor: error ? colors.error : focused ? colors.accent : colors.border,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[
            fieldStyles.input,
            multiline && fieldStyles.inputMultiline,
            { color: colors.textPrimary, fontFamily: fonts.body },
          ]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && hidden}
          multiline={multiline}
          placeholderTextColor={colors.textSecondary}
          // Extend the label with the error so VoiceOver surfaces the invalid
          // state when the field is focused (iOS has no live-region equivalent).
          accessibilityLabel={error ? `${label}, ${error}` : label}
          testID={testID}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={16}
            testID={`${testID}-toggle`}
          >
            <Text style={[fieldStyles.toggle, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              {hidden ? 'Show' : 'Hide'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          testID={`${testID}-error`}
          accessibilityLiveRegion="polite"
          style={[fieldStyles.meta, { color: colors.errorText, fontFamily: fonts.body }]}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text style={[fieldStyles.meta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  field: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 12, letterSpacing: 0.2 },
  optional: { fontSize: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: HAIRLINE,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  toggle: { fontSize: 14, marginLeft: 12 },
  meta: { fontSize: 13, marginTop: 6, lineHeight: 18 },
});

// ---------------------------------------------------------------------------
// Buttons and links
// ---------------------------------------------------------------------------

interface ButtonProps {
  label: string;
  onPress: () => void;
  testID: string;
  loading?: boolean;
  disabled?: boolean;
}

export function SecondaryButton({ label, onPress, testID, loading = false, disabled = false }: ButtonProps) {
  const { colors, fonts } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        buttonStyles.secondary,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textPrimary} />
      ) : (
        <Text
          style={[buttonStyles.secondaryLabel, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function TextLink({ label, onPress, testID, disabled = false }: ButtonProps) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [buttonStyles.link, { opacity: pressed || disabled ? 0.7 : 1 }]}
    >
      <Text style={[buttonStyles.linkLabel, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  secondary: {
    borderRadius: 10,
    borderWidth: 0.5,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryLabel: { fontSize: 16 },
  link: { alignSelf: 'center', paddingVertical: 8 },
  linkLabel: { fontSize: 14 },
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
