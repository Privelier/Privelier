/**
 * Add or edit one availability window: a weekly day or one date, then a
 * start and an end time. Hairline inputs turn brass on focus and red on
 * error, with the error under the field.
 */
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Notice } from '../../../shared/components/Notice';
import { PrimaryButton } from '../../../shared/components/PrimaryButton';
import { pressOpacity } from '../../../theme/motion';
import { useTheme } from '../../../theme/useTheme';
import { formatDateEntry, formatTimeEntry, type AvailabilityFormState, type AvailabilityMode } from '../../hooks/useAvailabilityForm';
import { availabilityStyles as styles, dayLabels, dayShort } from './availabilityStyles';

type FieldName = 'date' | 'startTime' | 'endTime';

function LabeledField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  field,
  focused,
  onFocusChange,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  error: string | undefined;
  field: FieldName;
  focused: FieldName | null;
  onFocusChange: (next: FieldName | null) => void;
  testID: string;
}) {
  const { colors, fonts, isDark } = useTheme();
  const borderColor = error ? colors.error : focused === field ? colors.accent : colors.border;
  return (
    <>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      <TextInput
        value={value}
        // Digits only; the separators are inserted while typing.
        onChangeText={(next) => onChangeText(field === 'date' ? formatDateEntry(next) : formatTimeEntry(next))}
        keyboardType="number-pad"
        maxLength={field === 'date' ? 10 : 5}
        onFocus={() => onFocusChange(field)}
        onBlur={() => onFocusChange(focused === field ? null : focused)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.background, borderColor, fontFamily: fonts.body }]}
        testID={testID}
      />
      {error ? <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>{error}</Text> : null}
    </>
  );
}

function ModeSegment({ value, active, label, accessibilityLabel, onPress }: {
  value: AvailabilityMode;
  active: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      testID={`barber-availability-mode-${value}`}
      style={({ pressed }) => [styles.segment, active && { backgroundColor: colors.accent }, pressed ? { opacity: pressOpacity.soft } : null]}
    >
      <Text style={[styles.segmentText, { color: active ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
    </Pressable>
  );
}

export function AvailabilityForm({ form, de }: { form: AvailabilityFormState; de: boolean }) {
  const { colors, fonts } = useTheme();
  const [focused, setFocused] = useState<FieldName | null>(null);
  const { fieldErrors } = form;
  return (
    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.formTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {form.editingId ? (de ? 'Zeitfenster bearbeiten' : 'Edit window') : (de ? 'Zeitfenster hinzufügen' : 'Add a window')}
      </Text>

      {form.formError ? <Notice testID="barber-availability-form-error" message={form.formError} style={styles.noticeMargins} /> : null}

      <View style={[styles.segmented, { borderColor: colors.border }]}>
        <ModeSegment
          value="day"
          active={form.mode === 'day'}
          label={de ? 'Wochentag' : 'Day of week'}
          accessibilityLabel={de ? 'Wöchentlich an einem Wochentag wiederholen' : 'Repeat weekly on a day of the week'}
          onPress={() => form.switchMode('day')}
        />
        <ModeSegment
          value="date"
          active={form.mode === 'date'}
          label={de ? 'Bestimmtes Datum' : 'Specific date'}
          accessibilityLabel={de ? 'Ein bestimmtes Datum' : 'A single specific date'}
          onPress={() => form.switchMode('date')}
        />
      </View>

      {form.mode === 'day' ? (
        <>
          <View style={styles.dayRow}>
            {dayLabels(de).map((label, index) => {
              const selected = form.selectedDay === index;
              return (
                <Pressable
                  key={label}
                  onPress={() => form.setSelectedDay(index)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  hitSlop={6}
                  testID={`barber-availability-day-${index}`}
                  style={({ pressed }) => [
                    styles.dayChip,
                    { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : 'transparent', opacity: pressed ? pressOpacity.soft : 1 },
                  ]}
                >
                  <Text style={[styles.dayChipText, { color: selected ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                    {dayShort(index, de)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {fieldErrors.day ? <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>{fieldErrors.day}</Text> : null}
        </>
      ) : (
        <LabeledField
          label={de ? 'Datum' : 'Date'}
          value={form.specificDate}
          onChangeText={form.setSpecificDate}
          placeholder={de ? 'JJJJ-MM-TT' : 'YYYY-MM-DD'}
          error={fieldErrors.date}
          field="date"
          focused={focused}
          onFocusChange={setFocused}
          testID="barber-availability-date"
        />
      )}

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <LabeledField
            label={de ? 'Startzeit' : 'Start time'}
            value={form.startTime}
            onChangeText={form.setStartTime}
            placeholder="09:00"
            error={fieldErrors.startTime}
            field="startTime"
            focused={focused}
            onFocusChange={setFocused}
            testID="barber-availability-start-time"
          />
        </View>
        <View style={styles.timeField}>
          <LabeledField
            label={de ? 'Endzeit' : 'End time'}
            value={form.endTime}
            onChangeText={form.setEndTime}
            placeholder="17:00"
            error={fieldErrors.endTime}
            field="endTime"
            focused={focused}
            onFocusChange={setFocused}
            testID="barber-availability-end-time"
          />
        </View>
      </View>

      <View style={styles.formActions}>
        <PrimaryButton
          label={form.editingId ? (de ? 'Änderungen speichern' : 'Save changes') : (de ? 'Zeitfenster hinzufügen' : 'Add window')}
          icon={form.editingId ? 'check' : 'plus'}
          onPress={() => void form.submit()}
          loading={form.submitting}
          disabled={form.submitting}
          testID="barber-availability-submit"
        />
        {form.editingId ? (
          <Pressable
            onPress={form.resetForm}
            disabled={form.submitting}
            accessibilityRole="button"
            accessibilityLabel={de ? 'Bearbeiten abbrechen' : 'Cancel edit'}
            testID="barber-availability-cancel-edit"
            style={({ pressed }) => [styles.cancelButton, pressed ? { opacity: pressOpacity.soft } : null]}
          >
            <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Abbrechen' : 'Cancel'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
