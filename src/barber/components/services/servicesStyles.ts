import { StyleSheet } from 'react-native';
import { HAIRLINE, radius, space } from '../../../theme/spacing';

/** Common service lengths; the field stays free for any whole minute value. */
export const DURATION_PRESETS = [15, 30, 45, 60, 90] as const;

export const servicesStyles = StyleSheet.create({
  durationChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  durationChip: { minWidth: 48, minHeight: 40, borderWidth: 0.5, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  durationChipText: { fontSize: 14 },
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
