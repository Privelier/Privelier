import { StyleSheet } from 'react-native';
import { HAIRLINE, radius, space } from '../../../theme/spacing';

/** Weekday names, Sunday = 0 (matching day_of_week). */
export function dayLabels(de: boolean): readonly string[] {
  return de
    ? ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
}

export function dayShort(index: number, de: boolean): string {
  return de ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][index] : dayLabels(false)[index].slice(0, 3);
}

export const availabilityStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: space.xl, paddingTop: space.md },
  heading: { fontSize: 24, marginTop: 16 },
  listContent: { paddingHorizontal: space.xl, paddingBottom: space['2xl'] },
  form: { borderWidth: HAIRLINE, borderRadius: radius.lg, padding: space.base, marginTop: 20, marginBottom: 28 },
  formTitle: { fontSize: 19, marginBottom: 14 },
  label: { fontSize: 14, marginBottom: 6, marginTop: 14, letterSpacing: 0 },
  input: { borderWidth: HAIRLINE, borderRadius: 14, minHeight: 54, paddingHorizontal: 14, paddingVertical: space.md, fontSize: 16 },
  errorText: { fontSize: 13, marginTop: 4 },
  helperText: { fontSize: 13, marginTop: 4 },
  noticeMargins: { marginBottom: space.md },
  segmented: { flexDirection: 'row', borderWidth: HAIRLINE, borderRadius: radius.md, overflow: 'hidden', marginTop: 4 },
  segment: { minHeight: 48, flex: 1, paddingVertical: space.md, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 12 },
  dayChip: { minHeight: 44, justifyContent: 'center', borderWidth: HAIRLINE, borderRadius: radius.sm, paddingVertical: space.sm, paddingHorizontal: 10 },
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
