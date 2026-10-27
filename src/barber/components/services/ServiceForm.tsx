/**
 * The add/edit service form: name (with the soft duplicate-name hint),
 * price, duration with presets, and submit/cancel. Inputs outline brass on
 * focus and red on error.
 */
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { Notice } from '../../../shared/components/Notice';
import { PrimaryButton } from '../../../shared/components/PrimaryButton';
import { haptics } from '../../../shared/haptics';
import type { Palette } from '../../../theme/colors';
import { pressOpacity } from '../../../theme/motion';
import { numericText } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { FieldName, ServicesFormState } from '../../hooks/useServicesForm';
import { DURATION_PRESETS, servicesStyles as styles } from './servicesStyles';

function outlineColor(hasError: boolean, focused: boolean, colors: Palette): string {
  if (hasError) return colors.error;
  if (focused) return colors.accent;
  return colors.border;
}

function FormField({ form, field, label, accessibilityLabel, value, onChangeText, placeholder, keyboardType, testID }: {
  form: ServicesFormState;
  field: FieldName;
  label: string;
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  testID: string;
}) {
  const { colors, fonts, isDark } = useTheme();
  return (
    <>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => form.setFocusedField(field)}
        onBlur={() => form.setFocusedField((current) => (current === field ? null : current))}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        accessibilityLabel={accessibilityLabel}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.background,
            borderColor: outlineColor(!!form.fieldErrors[field], form.focusedField === field, colors),
            fontFamily: fonts.body,
          },
        ]}
        testID={testID}
      />
    </>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  const { colors, fonts } = useTheme();
  return message ? <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>{message}</Text> : null;
}

function DurationPresets({ form, de }: { form: ServicesFormState; de: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.durationChips} testID="barber-services-duration-presets">
      {DURATION_PRESETS.map((minutes) => {
        const selected = form.duration.trim() === String(minutes);
        return (
          <Pressable
            key={minutes}
            onPress={() => {
              void haptics.selection();
              form.setDuration(String(minutes));
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={de ? `${minutes} Minuten` : `${minutes} minutes`}
            testID={`barber-services-duration-preset-${minutes}`}
            style={[
              styles.durationChip,
              { borderColor: selected ? colors.accent : colors.inputBorder, backgroundColor: selected ? colors.accent : 'transparent' },
            ]}
          >
            <Text style={[styles.durationChipText, numericText, { color: selected ? colors.onAccent : colors.textPrimary }]}>{minutes}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ServiceForm({ form, de }: { form: ServicesFormState; de: boolean }) {
  const { colors, fonts } = useTheme();
  const editing = form.editingId !== null;
  return (
    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.formTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {editing ? (de ? 'Leistung bearbeiten' : 'Edit service') : (de ? 'Leistung hinzufügen' : 'Add a service')}
      </Text>

      {form.formError ? <Notice testID="barber-services-form-error" message={form.formError} style={styles.noticeMargins} /> : null}

      <FormField
        form={form}
        field="name"
        label="Name"
        accessibilityLabel="Name"
        value={form.name}
        onChangeText={form.setName}
        placeholder={de ? 'z. B. Klassischer Haarschnitt' : 'e.g. Classic haircut'}
        testID="barber-services-name"
      />
      {form.fieldErrors.name ? (
        <FieldError message={form.fieldErrors.name} />
      ) : form.isDuplicateName ? (
        <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {de ? 'Du hast schon eine Leistung mit diesem Namen. Du kannst sie trotzdem speichern.' : 'You already have a service with this name. You can still save it.'}
        </Text>
      ) : null}

      <FormField
        form={form}
        field="price"
        label={de ? 'Preis' : 'Price'}
        accessibilityLabel={de ? 'Preis' : 'Price'}
        value={form.price}
        onChangeText={form.setPrice}
        placeholder="0.00"
        keyboardType="decimal-pad"
        testID="barber-services-price"
      />
      <FieldError message={form.fieldErrors.price} />

      <FormField
        form={form}
        field="duration"
        label={de ? 'Dauer (Minuten)' : 'Duration (minutes)'}
        accessibilityLabel={de ? 'Dauer in Minuten' : 'Duration in minutes'}
        value={form.duration}
        onChangeText={form.setDuration}
        placeholder="30"
        keyboardType="number-pad"
        testID="barber-services-duration"
      />
      <DurationPresets form={form} de={de} />
      <FieldError message={form.fieldErrors.duration} />

      <View style={styles.formActions}>
        <PrimaryButton
          label={editing ? (de ? 'Änderungen speichern' : 'Save changes') : (de ? 'Leistung hinzufügen' : 'Add service')}
          icon={editing ? 'check' : 'plus'}
          onPress={form.onSubmit}
          loading={form.submitting}
          disabled={form.submitting}
          testID="barber-services-submit"
        />
        {editing ? (
          <Pressable
            onPress={form.resetForm}
            disabled={form.submitting}
            accessibilityRole="button"
            accessibilityLabel={de ? 'Bearbeiten abbrechen' : 'Cancel edit'}
            testID="barber-services-cancel-edit"
            style={({ pressed }) => [styles.cancelButton, pressed ? { opacity: pressOpacity.soft } : null]}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Abbrechen' : 'Cancel'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
