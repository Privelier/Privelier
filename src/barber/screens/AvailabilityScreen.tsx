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

export default function AvailabilityScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();

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
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={16}
          testID="barber-availability-back"
        >
          <Text style={[styles.backText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
            {'‹ Back'}
          </Text>
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
          Availability
        </Text>
      </View>

      <FlatList
        data={windows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
              {editingId ? 'Edit window' : 'Add a window'}
            </Text>

            {formError ? (
              <View
                testID="barber-availability-form-error"
                accessibilityRole="alert"
                style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.background }]}
              >
                <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <View style={[styles.segmented, { borderColor: colors.border }]}>
              <Pressable
                onPress={() => switchMode('day')}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'day' }}
                accessibilityLabel="Repeat weekly on a day of the week"
                testID="barber-availability-mode-day"
                style={[styles.segment, mode === 'day' && { backgroundColor: colors.accent }]}
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
                style={[styles.segment, mode === 'date' && { backgroundColor: colors.accent }]}
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
                    testID={`barber-availability-day-${index}`}
                    style={[
                      styles.dayChip,
                      {
                        borderColor: selectedDay === index ? colors.accent : colors.border,
                        backgroundColor: selectedDay === index ? colors.accent : 'transparent',
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
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Date"
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      borderColor: fieldErrors.date ? colors.error : colors.border,
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
                  placeholder="09:00"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Start time"
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      borderColor: fieldErrors.startTime ? colors.error : colors.border,
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
                  placeholder="17:00"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="End time"
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      borderColor: fieldErrors.endTime ? colors.error : colors.border,
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
              <Pressable
                onPress={onSubmit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={editingId ? 'Save changes' : 'Add window'}
                testID="barber-availability-submit"
                style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 }]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
                    {editingId ? 'Save changes' : 'Add window'}
                  </Text>
                )}
              </Pressable>
              {editingId ? (
                <Pressable
                  onPress={resetForm}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel edit"
                  testID="barber-availability-cancel-edit"
                  style={styles.cancelButton}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
                    Cancel
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={[styles.listTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
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
        }
        renderItem={({ item }) => (
          <View
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                hitSlop={8}
                testID={`barber-availability-edit-${item.id}`}
              >
                <Text style={[styles.rowActionText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                  Edit
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(item)}
                accessibilityRole="button"
                accessibilityLabel="Delete window"
                hitSlop={8}
                testID={`barber-availability-delete-${item.id}`}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, gap: 16 },
  backText: { fontSize: 15 },
  heading: { fontSize: 22 },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  form: { borderWidth: 0.5, borderRadius: 12, padding: 16, marginTop: 16, marginBottom: 16 },
  formTitle: { fontSize: 16, marginBottom: 12 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  errorText: { fontSize: 13, marginTop: 4 },
  helperText: { fontSize: 13, marginTop: 4 },
  notice: { borderWidth: 0.5, borderRadius: 10, padding: 12, marginBottom: 12 },
  noticeText: { fontSize: 14 },
  segmented: { flexDirection: 'row', borderWidth: 0.5, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  dayChip: { borderWidth: 0.5, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  dayChipText: { fontSize: 13 },
  timeRow: { flexDirection: 'row', gap: 16 },
  timeField: { flex: 1 },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  primaryButton: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 15 },
  cancelButton: { paddingVertical: 14, paddingHorizontal: 8 },
  cancelButtonText: { fontSize: 15 },
  listTitle: { fontSize: 15, marginTop: 24, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, marginBottom: 2 },
  rowMeta: { fontSize: 13 },
  rowActions: { flexDirection: 'row', gap: 16 },
  rowActionText: { fontSize: 14 },
});
