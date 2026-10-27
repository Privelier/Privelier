import { StyleSheet } from 'react-native';
import type { Palette } from '../../../theme/colors';
import { useTheme } from '../../../theme/useTheme';
import { glass } from '../GlassSurface';

export function useConversationStyles(colors: Palette) {
  const { fonts } = useTheme();
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 12,
      marginHorizontal: 12,
      marginTop: 8,
      borderRadius: 22,
    },
    headerText: { flex: 1, minWidth: 0 },
    headerTitle: { fontSize: 18, color: colors.textPrimary, fontFamily: fonts.headingMedium },
    headerSubtitle: { fontSize: 13, marginTop: 2, color: colors.textSecondary, fontFamily: fonts.body },

    body: { flex: 1 },
    noticeMargins: { marginTop: 24, marginHorizontal: 24 },

    listContent: { paddingHorizontal: 24, paddingVertical: 16, flexGrow: 1 },
    dayDivider: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34, marginVertical: 6 },
    dayRule: { flex: 1, height: 0.5, backgroundColor: 'rgba(191,160,107,0.32)' },
    dayPill: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
    dayLabel: { color: colors.textSecondary, fontSize: 11, fontFamily: fonts.bodyMedium },
    historyControl: { alignItems: 'center', paddingBottom: 16 },
    earlierError: {
      maxWidth: 280,
      marginBottom: 8,
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
      color: colors.errorText,
      fontFamily: fonts.body,
    },
    loadEarlierButton: {
      minWidth: 200,
      minHeight: 44,
      paddingHorizontal: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
      borderRadius: 8,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    loadEarlierButtonDisabled: { opacity: 0.6 },
    loadEarlierIndicator: { position: 'absolute', left: 16 },
    loadEarlierLabel: { fontSize: 13, color: colors.accentText, fontFamily: fonts.bodyMedium },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body },

    bubble: {
      maxWidth: '86%',
      borderWidth: 0.5,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 10,
      overflow: 'hidden',
    },
    bubbleTheirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
    bubbleOwn: { alignSelf: 'flex-end', borderBottomRightRadius: 5 },
    // Not yet confirmed by the server: a touch quieter than a delivered bubble.
    bubblePending: { opacity: 0.78 },
    bubbleText: { fontSize: 16, lineHeight: 23, color: colors.textPrimary, fontFamily: fonts.body },
    bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
    bubbleMeta: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },
    bubbleMetaFailed: { fontSize: 12, marginTop: 4, color: colors.errorText, fontFamily: fonts.bodyMedium },
    bubbleFailureReason: {
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
      color: colors.textSecondary,
      fontFamily: fonts.body,
    },
    // Muted and weight-only near the cap — never red: maxLength makes overflow
    // impossible, so reaching the limit is not an error state.
    messageCounter: {
      fontSize: 11,
      textAlign: 'right',
      paddingHorizontal: 16,
      paddingBottom: 4,
      color: colors.textSecondary,
      fontFamily: fonts.body,
    },

    typingSlot: { height: 18, justifyContent: 'center', paddingHorizontal: 24 },
    typingText: { fontSize: 11, color: colors.textSecondary, fontFamily: fonts.body },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginHorizontal: 12,
      marginBottom: 6,
      borderRadius: 22,
    },
    input: {
      flex: 1,
      minHeight: 48,
      maxHeight: 144,
      borderWidth: 0.5,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      // A recessed well inside the glass composer.
      borderColor: glass.edge,
      backgroundColor: 'rgba(8,8,10,0.42)',
      color: colors.textPrimary,
      fontFamily: fonts.body,
    },
    // Round brass send disc with a lit top edge, aligned to the input's last line.
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      experimental_backgroundImage: 'linear-gradient(160deg, rgba(255,240,210,0.38) 0%, rgba(255,240,210,0) 55%)',
      boxShadow: 'inset 0 1px 0 rgba(255,248,232,0.45), 0 6px 16px rgba(191,160,107,0.22)',
    },
    sendButtonDisabled: { opacity: 0.45 },

    quickRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    quickChip: { minHeight: 36, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 14, overflow: 'hidden' },
    quickText: { fontSize: 13, color: colors.textPrimary, fontFamily: fonts.body },
  });
}

export type ConversationStyles = ReturnType<typeof useConversationStyles>;
