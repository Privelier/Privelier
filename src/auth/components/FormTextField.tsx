/**
 * Auth text field: label, optional marker, error or helper text and a
 * secure show/hide toggle. Inputs outline brass on focus and red on error.
 */
import { useState, type Ref } from 'react';
import { StyleSheet, Text, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { Input, InputField, InputSlot } from '../../../components/ui/input';
import { getAppLanguage } from '../../shared/locale';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { useTheme } from '../../theme/useTheme';

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
  inputRef?: Ref<TextInputInstance>;
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
  const de = getAppLanguage() === 'de';
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
      <Input
        className="rounded-xl"
        style={[
          fieldStyles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : focused ? colors.accent : colors.inputBorder,
          },
        ]}
        isDisabled={false}
      >
        <InputField
          ref={inputRef as unknown as Ref<TextInputProps>}
          style={[fieldStyles.input, multiline && fieldStyles.inputMultiline, { color: colors.textPrimary, fontFamily: fonts.body }]}
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
          <InputSlot
            onPress={() => setHidden((current) => !current)}
            accessibilityLabel={de ? (hidden ? 'Passwort anzeigen' : 'Passwort ausblenden') : hidden ? 'Show password' : 'Hide password'}
            className="min-h-11 min-w-11"
          >
            <Text style={[fieldStyles.toggle, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
              {de ? (hidden ? 'Anzeigen' : 'Ausblenden') : hidden ? 'Show' : 'Hide'}
            </Text>
          </InputSlot>
        ) : null}
      </Input>
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
  label: { ...typeScale.body, letterSpacing: 0 },
  optional: typeScale.caption,
  inputRow: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: space.base,
  },
  input: { flex: 1, fontSize: typeScale.bodyLarge.fontSize, paddingVertical: 10 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  toggle: { ...typeScale.body, marginLeft: space.md },
  meta: { ...typeScale.secondary, marginTop: 6 },
});
