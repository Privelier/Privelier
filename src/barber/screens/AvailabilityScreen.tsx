/**
 * Barber availability-management screen (build-order step 7-8).
 *
 * Lists the barber's own availability windows and lets them create/edit/
 * delete a window via the Stage 4 data layer (availabilityData.ts). A window
 * is EITHER a day-of-week OR a specific date — the UI enforces this with a
 * segmented toggle (not just the DB's chk_availability_day_or_date check),
 * so the two inputs are always mutually exclusive from the user's point of
 * view. day_of_week follows the same convention as JS Date#getDay() /
 * Postgres extract(dow): 0 = Sunday .. 6 = Saturday.
 *
 * Visual pass (2026-07-09): restyled to the Lovable prototype's form look —
 * hairline-underline inputs (brass on focus), a full-width brass submit
 * button, and editorial serif section headers — matching the pattern already
 * used on the Studio/Inbox/Account-section screens. No behavior, validation,
 * or testID changed.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { BackButton } from '../../shared/components/ScreenBackHeader';
import { Notice } from '../../shared/components/Notice';
import type { Palette } from '../../theme/colors';
import type { AvailabilityRow } from '../../types';
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
  listOwnAvailability,
  updateAvailabilityWindow,
} from '../availabilityData';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'Availability'>;

type Mode = 'day' | 'date';
type FieldName = 'date' | 'startTime' | 'endTime';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface FieldErrors {
  day?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

function toHm(time: string): string {
  // Server rows may come back as "HH:MM:SS" — the form only edits HH:MM.
  return time.length >= 5 ? time.slice(0, 5) : time;
}

function dateFieldError(value: string): string | undefined {
  if (value.trim().length === 0) return 'Enter a date.';
  if (!DATE_PATTERN.test(value.trim())) return 'Use the format YYYY-MM-DD.';
  if (Number.isNaN(new Date(value.trim()).getTime())) return 'That date is not valid.';
  return undefined;
}

function timeFieldError(value: string, label: string): string | undefined {
  if (value.trim().length === 0) return `Enter a ${label} time.`;
  if (!TIME_PATTERN.test(value.trim())) return 'Use the 24-hour format HH:MM.';
  return undefined;
}

function underlineColor(hasError: boolean, focused: boolean, colors: Palette): string {
  if (hasError) return colors.error;
  if (focused) return colors.accent;
  return colors.border;
}

export default function AvailabilityScreen({ navigation }: Props) {
  const { colors, fonts, isDark } = useTheme();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [windows, setWindows] = useState<AvailabilityRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('day');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [specificDate, setSpecificDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<FieldName | null>(null);

  const loadWindows = useCallback(async (id: string) => {
    setListLoading(true);
    setListError(null);
    const result = await listOwnAvailability(id);
    setListLoading(false);
    if (result.status === 'ok') {
      setWindows(result.windows);
    } else {
      setListError(result.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user.id ?? null;
      setBarberId(id);
      if (id) {
        void loadWindows(id);
      } else {
        setListLoading(false);
        setListError('We could not find your account. Try signing out and back in.');
      }
    });
    return () => {
      active = false;
    };
  }, [loadWindows]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setMode('day');
    setSelectedDay(null);
    setSpecificDate('');
    setStartTime('');
    setEndTime('');
    setFieldErrors({});
    setFormError(null);
  }, []);

  const startEdit = useCallback((window: AvailabilityRow) => {
    setEditingId(window.id);
    if (window.day_of_week !== null) {
      setMode('day');
      setSelectedDay(window.day_of_week);
      setSpecificDate('');
    } else {
      setMode('date');
      setSelectedDay(null);
      setSpecificDate(window.specific_date ?? '');
    }
    setStartTime(toHm(window.start_time));
    setEndTime(toHm(window.end_time));
    setFieldErrors({});
    setFormError(null);
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
  }, []);

  const onSubmit = useCallback(async () => {
    const errors: FieldErrors = {
      day: mode === 'day' && selectedDay === null ? 'Choose a day of the week.' : undefined,
      date: mode === 'date' ? dateFieldError(specificDate) : undefined,
      startTime: timeFieldError(startTime, 'start'),
      endTime: timeFieldError(endTime, 'end'),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.day || errors.date || errors.startTime || errors.endTime) return;
    if (startTime.trim() >= endTime.trim()) {
      setFieldErrors({ ...errors, endTime: 'End time must be after start time.' });
      return;
    }
    if (!barberId) {
      setFormError('We could not find your account. Try signing out and back in.');
      return;
    }

    setSubmitting(true);

    if (editingId) {
      const result = await updateAvailabilityWindow(editingId, {
        dayOfWeek: mode === 'day' ? selectedDay : null,
        specificDate: mode === 'date' ? specificDate.trim() : null,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
      });
      setSubmitting(false);
      if (result.status === 'ok') {
        resetForm();
        void loadWindows(barberId);
      } else if (result.status === 'not_found') {
        setFormError('This availability window no longer exists.');
        void loadWindows(barberId);
      } else {
        setFormError(result.message);
      }
    } else {
      const result = await createAvailabilityWindow({
        barberId,
        dayOfWeek: mode === 'day' ? (selectedDay ?? undefined) : undefined,
        specificDate: mode === 'date' ? specificDate.trim() : undefined,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
      });
      setSubmitting(false);
      if (result.status === 'ok') {
        resetForm();
        void loadWindows(barberId);
      } else {
        setFormError(result.message);
      }
    }
  }, [mode, selectedDay, specificDate, startTime, endTime, barberId, editingId, resetForm, loadWindows]);

  const onDelete = useCallback(
    (window: AvailabilityRow) => {
      const label = window.day_of_week !== null ? DAY_LABELS[window.day_of_week] : window.specific_date;
      Alert.alert('Delete availability', `Delete the window on ${label}? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAvailabilityWindow(window.id);
            if (result.status === 'ok' || result.status === 'not_found') {
              setWindows((current) => current.filter((item) => item.id !== window.id));
              if (editingId === window.id) resetForm();
            } else {
              Alert.alert('Could not delete', result.message);
            }
          },
        },
      ]);
    },
    [editingId, resetForm]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="barber-availability-screen"
    >
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} testID="barber-availability-back" />
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Availability
        </Text>
      </View>

      <FlatList
        data={windows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.formTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                {editingId ? 'Edit window' : 'Add a window'}
              </Text>

              {formError ? (
                <Notice testID="barber-availability-form-error" message={formError} style={styles.noticeMargins} />
              ) : null}

              <View style={[styles.segmented, { borderColor: colors.border }]}>
                <Pressable
                  onPress={() => switchMode('day')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === 'day' }}
                  accessibilityLabel="Repeat weekly on a day of the week"
                  testID="barber-availability-mode-day"
                  style={({ pressed }) => [
                    styles.segment,
                    mode === 'day' && { backgroundColor: colors.accent },
                    pressed ? { opacity: pressOpacity.soft } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: mode === 'day' ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodyMedium },
                    ]}
                  >
                    Day of week
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => switchMode('date')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === 'date' }}
                  accessibilityLabel="A single specific date"
                  testID="barber-availability-mode-date"
                  style={({ pressed }) => [
                    styles.segment,
                    mode === 'date' && { backgroundColor: colors.accent },
                    pressed ? { opacity: pressOpacity.soft } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: mode === 'date' ? colors.onAccent : colors.textPrimary, fontFamily: fonts.bodyMedium },
                    ]}
                  >
                    Specific date
                  </Text>
                </Pressable>
              </View>

              {mode === 'day' ? (
                <View style={styles.dayRow}>
                  {DAY_LABELS.map((label, index) => (
                    <Pressable
                      key={label}
                      onPress={() => setSelectedDay(index)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedDay === index }}
                      accessibilityLabel={label}
                      hitSlop={6}
                      testID={`barber-availability-day-${index}`}
                      style={({ pressed }) => [
                        styles.dayChip,
                        {
                          borderColor: selectedDay === index ? colors.accent : colors.border,
                          backgroundColor: selectedDay === index ? colors.accent : 'transparent',
                          opacity: pressed ? pressOpacity.soft : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          {
                            color: selectedDay === index ? colors.onAccent : colors.textPrimary,
                            fontFamily: fonts.bodyMedium,
                          },
                        ]}
                      >
                        {label.slice(0, 3)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
                    Date
                  </Text>
                  <TextInput
                    value={specificDate}
                    onChangeText={setSpecificDate}
                    onFocus={() => setFocusedField('date')}
                    onBlur={() => setFocusedField((current) => (current === 'date' ? null : current))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel="Date"
                    selectionColor={colors.accent}
                    cursorColor={colors.accent}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderBottomColor: underlineColor(!!fieldErrors.date, focusedField === 'date', colors),
                        fontFamily: fonts.body,
                      },
                    ]}
                    testID="barber-availability-date"
                  />
                </>
              )}
              {fieldErrors.day ? (
                <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                  {fieldErrors.day}
                </Text>
              ) : null}
              {fieldErrors.date ? (
                <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                  {fieldErrors.date}
                </Text>
              ) : null}

              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
                    Start time
                  </Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    onFocus={() => setFocusedField('startTime')}
                    onBlur={() => setFocusedField((current) => (current === 'startTime' ? null : current))}
                    placeholder="09:00"
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel="Start time"
                    selectionColor={colors.accent}
                    cursorColor={colors.accent}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderBottomColor: underlineColor(!!fieldErrors.startTime, focusedField === 'startTime', colors),
                        fontFamily: fonts.body,
                      },
                    ]}
                    testID="barber-availability-start-time"
                  />
                  {fieldErrors.startTime ? (
                    <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                      {fieldErrors.startTime}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.timeField}>
                  <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
                    End time
                  </Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    onFocus={() => setFocusedField('endTime')}
                    onBlur={() => setFocusedField((current) => (current === 'endTime' ? null : current))}
                    placeholder="17:00"
                    placeholderTextColor={colors.textSecondary}
                    accessibilityLabel="End time"
                    selectionColor={colors.accent}
                    cursorColor={colors.accent}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    style={[
                      styles.input,
                      {
                        color: colors.textPrimary,
                        borderBottomColor: underlineColor(!!fieldErrors.endTime, focusedField === 'endTime', colors),
                        fontFamily: fonts.body,
                      },
                    ]}
                    testID="barber-availability-end-time"
                  />
                  {fieldErrors.endTime ? (
                    <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                      {fieldErrors.endTime}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.formActions}>
                <PrimaryButton
                  label={editingId ? 'Save changes' : 'Add window'}
                  icon={editingId ? 'check' : 'plus'}
                  onPress={onSubmit}
                  loading={submitting}
                  disabled={submitting}
                  testID="barber-availability-submit"
                />
                {editingId ? (
                  <Pressable
                    onPress={resetForm}
                    disabled={submitting}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel edit"
                    testID="barber-availability-cancel-edit"
                    style={({ pressed }) => [styles.cancelButton, pressed ? { opacity: pressOpacity.soft } : null]}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
                      Cancel
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                Your availability
              </Text>
              {listLoading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
              {listError ? (
                <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>
                  {listError}
                </Text>
              ) : null}
              {!listLoading && !listError && windows.length === 0 ? (
                <Text style={[styles.helperText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  You have not added any availability yet.
                </Text>
              ) : null}
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <View
            style={[styles.row, index > 0 ? { borderTopWidth: HAIRLINE, borderTopColor: colors.border } : null]}
            testID={`barber-availability-row-${item.id}`}
          >
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
                {item.day_of_week !== null ? DAY_LABELS[item.day_of_week] : item.specific_date}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {`${toHm(item.start_time)} – ${toHm(item.end_time)}`}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => startEdit(item)}
                accessibilityRole="button"
                accessibilityLabel="Edit window"
                hitSlop={14}
                testID={`barber-availability-edit-${item.id}`}
                style={({ pressed }) => (pressed ? { opacity: pressOpacity.soft } : null)}
              >
                {/* Plain, non-brass — see ServicesScreen's identical fix. */}
                <Text style={[styles.rowActionText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                  Edit
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(item)}
                accessibilityRole="button"
                accessibilityLabel="Delete window"
                hitSlop={14}
                testID={`barber-availability-delete-${item.id}`}
                style={({ pressed }) => (pressed ? { opacity: pressOpacity.firm } : null)}
              >
                <Text style={[styles.rowActionText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: space.xl, paddingTop: space.md },
  heading: { fontSize: 24, marginTop: 16 },
  listContent: { paddingHorizontal: space.xl, paddingBottom: space['2xl'] },
  form: { borderWidth: HAIRLINE, borderRadius: radius.lg, padding: space.base, marginTop: 20, marginBottom: 28 },
  formTitle: { fontSize: 19, marginBottom: 14 },
  label: { fontSize: 12, marginBottom: 6, marginTop: 14, letterSpacing: 0.2 },
  input: { borderBottomWidth: HAIRLINE, paddingVertical: space.md, fontSize: 16 },
  errorText: { fontSize: 13, marginTop: 4 },
  helperText: { fontSize: 13, marginTop: 4 },
  noticeMargins: { marginBottom: space.md },
  segmented: { flexDirection: 'row', borderWidth: HAIRLINE, borderRadius: radius.md, overflow: 'hidden', marginTop: 4 },
  segment: { flex: 1, paddingVertical: space.md, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 12 },
  dayChip: { borderWidth: HAIRLINE, borderRadius: radius.sm, paddingVertical: space.sm, paddingHorizontal: 10 },
  dayChipText: { fontSize: 13 },
  timeRow: { flexDirection: 'row', gap: 16 },
  timeField: { flex: 1 },
  formActions: { marginTop: 20, gap: space.md },
  cancelButton: { paddingVertical: space.sm, alignItems: 'center' },
  cancelButtonText: { fontSize: 14 },
  listHeader: { marginBottom: 4 },
  listTitle: { fontSize: 19, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, marginBottom: 2 },
  rowMeta: { fontSize: 13 },
  rowActions: { flexDirection: 'row', gap: 16 },
  rowActionText: { fontSize: 14 },
});
