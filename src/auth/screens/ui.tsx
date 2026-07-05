/**
 * Shared UI primitives for the PRE-AUTH shell and provisioning screens only.
 * (CLAUDE.md allows sharing here — never inside src/customer or src/barber.)
 *
 * Brand rules applied: flat design, 0.5px borders, brass accent restricted to
 * the primary CTA and active states, sentence case copy, serif headings.
 */
import { useState, type ReactNode } from 'react';
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

/** Ink used on top of the brass accent — dark in both modes for contrast. */
export const ON_ACCENT = '#121214';

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
      <Text style={[shellStyles.title, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
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
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      testID={testID}
      style={shellStyles.backLink}
    >
      <Text style={[shellStyles.backText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
        {'‹ Back'}
      </Text>
    </Pressable>
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
  backText: { fontSize: 15 },
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
}: FormTextFieldProps) {
  const { colors, fonts } = useTheme();
  const [hidden, setHidden] = useState(true);

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
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
          },
        ]}
      >
        <TextInput
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
          accessibilityLabel={label}
          testID={testID}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCorrect={false}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={12}
            testID={`${testID}-toggle`}
          >
            <Text style={[fieldStyles.toggle, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
              {hidden ? 'Show' : 'Hide'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          testID={`${testID}-error`}
          style={[fieldStyles.meta, { color: colors.error, fontFamily: fonts.body }]}
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13 },
  optional: { fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
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

/** Brass primary CTA — the ONLY place the accent appears as a fill. */
export function PrimaryButton({ label, onPress, testID, loading = false, disabled = false }: ButtonProps) {
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
        buttonStyles.primary,
        { backgroundColor: colors.accent, opacity: inactive ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={ON_ACCENT} />
      ) : (
        <Text style={[buttonStyles.primaryLabel, { fontFamily: fonts.bodySemiBold }]}>{label}</Text>
      )}
    </Pressable>
  );
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
  primary: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryLabel: { color: ON_ACCENT, fontSize: 16 },
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

export function Notice({
  kind,
  message,
  testID,
}: {
  kind: 'error' | 'success';
  message: string;
  testID: string;
}) {
  const { colors, fonts } = useTheme();
  const tone = kind === 'error' ? colors.error : colors.success;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[noticeStyles.box, { borderColor: tone, backgroundColor: colors.surface }]}
    >
      <Text style={[noticeStyles.text, { color: tone, fontFamily: fonts.bodyMedium }]}>{message}</Text>
    </View>
  );
}

const noticeStyles = StyleSheet.create({
  box: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  text: { fontSize: 14, lineHeight: 20 },
});
