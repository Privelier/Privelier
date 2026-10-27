import { StyleSheet } from 'react-native';
import type { Palette } from '../../../theme/colors';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export type RequestsStyles = ReturnType<typeof useRequestsStyles>;

export function useRequestsStyles(colors: Palette) {
  const { fonts } = useTheme();
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: space.xl, marginTop: space.xl },
    heading: { fontSize: 30, color: colors.textPrimary, fontFamily: fonts.headingMedium },
    subtitle: { fontSize: 14, marginTop: 4, color: colors.textSecondary, fontFamily: fonts.body },

    noticeMargins: { marginTop: space.xl, marginHorizontal: space.xl },

    listContent: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space['2xl'] },
    sectionHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, marginBottom: space.sm },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontFamily: fonts.bodyMedium },
    sectionCount: { minWidth: 22, color: colors.textSecondary, fontSize: 14, fontFamily: fonts.body, textAlign: 'center' },
    historyToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, borderTopWidth: HAIRLINE, borderColor: colors.border },
    historyAction: { marginLeft: 'auto', color: colors.accentText, fontSize: 14, fontFamily: fonts.bodyMedium },

    card: {
      padding: space.base,
      marginBottom: space.md,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    cardInfo: { flex: 1, minWidth: 0 },
    cardTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: fonts.bodySemiBold },
    cardMeta: { fontSize: 14, marginTop: 4, color: colors.textSecondary, fontFamily: fonts.body },
    cardRight: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '45%' },
    cardPrice: { fontSize: 14, color: colors.textPrimary, fontFamily: fonts.body },
    cardStatus: {
      marginTop: space.xs,
      alignSelf: 'flex-end',
    },

    actions: { flexDirection: 'row', gap: space.md, marginTop: space.base, alignItems: 'center' },
    actionSpinner: { paddingVertical: space.md },
    actionButton: {
      flex: 1,
      borderRadius: radius.sm,
      paddingVertical: space.base,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPressed: { opacity: pressOpacity.firm },
    actionPrimary: { backgroundColor: colors.accent },
    actionPrimaryText: { fontSize: 14, color: colors.onAccent, fontFamily: fonts.bodySemiBold },
    actionSecondary: { borderWidth: HAIRLINE, borderColor: colors.error },
    actionSecondaryText: { fontSize: 14, color: colors.errorText, fontFamily: fonts.bodyMedium },
    actionSuccess: { borderWidth: HAIRLINE, borderColor: colors.success },
    actionSuccessText: { fontSize: 14, color: colors.successText, fontFamily: fonts.bodyMedium },

    rowError: {
      marginTop: space.md,
      borderTopWidth: HAIRLINE,
      borderTopColor: colors.border,
      paddingTop: space.md,
    },
    rowErrorText: { fontSize: 14, color: colors.errorText, fontFamily: fonts.bodyMedium },
    detailsLink: { color: colors.accentText, fontSize: 13, marginTop: 16 },
    actionError: { color: colors.errorText, marginTop: 16 },
  });
}
