/**
 * Content-shaped first-load placeholders for the screens that still showed a
 * bare spinner. Each composes the shared Skeleton block (static under Reduce
 * Motion) into the layout the real content will occupy, so nothing jumps when
 * data arrives. They are shapes only — no sample text, counts, or states.
 *
 * Each placeholder is one accessible progress element; the decorative blocks
 * stay out of the accessibility tree.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { Skeleton } from './Skeleton';
import { PortfolioGrid, portfolioTileStyle } from './PortfolioGrid';

type PlaceholderProps = { testID: string; label: string; style?: StyleProp<ViewStyle> };

/** A single-field editor: label, input body, helper line, primary action. */
export function FormSkeleton({ testID, label, style, multiline = false }: PlaceholderProps & { multiline?: boolean }) {
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label} style={[styles.form, style]}>
      <Skeleton style={styles.fieldLabel} />
      <Skeleton style={[styles.field, multiline && styles.fieldMultiline]} />
      <Skeleton style={styles.helper} />
      <Skeleton style={styles.action} />
    </View>
  );
}

/** Managed rows (services, availability windows): title/meta plus two actions. */
export function RowListSkeleton({ testID, label, style, rows = 2 }: PlaceholderProps & { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label} style={style}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.rowText}>
            <Skeleton style={styles.rowTitle} />
            <Skeleton style={styles.rowMeta} />
          </View>
          <Skeleton style={styles.rowAction} />
          <Skeleton style={styles.rowAction} />
        </View>
      ))}
    </View>
  );
}

/** The two-column portfolio grid at its real tile size. */
export function PortfolioGridSkeleton({ testID, label, style, tiles = 4 }: PlaceholderProps & { tiles?: number }) {
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label} style={style}>
      <PortfolioGrid>
        {Array.from({ length: tiles }, (_, index) => (
          <Skeleton key={index} style={portfolioTileStyle} />
        ))}
      </PortfolioGrid>
    </View>
  );
}

/** A status card followed by document rows (barber verification). */
export function StatusCardSkeleton({ testID, label, style, rows = 2 }: PlaceholderProps & { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label} style={style}>
      <View style={[styles.statusCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Skeleton style={styles.statusPill} />
        <Skeleton style={styles.statusLine} />
        <Skeleton style={styles.statusLineShort} />
      </View>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={[styles.docRow, { borderColor: colors.border }]}>
          <Skeleton style={styles.docIcon} />
          <View style={styles.rowText}>
            <Skeleton style={styles.rowTitle} />
            <Skeleton style={styles.rowMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Barber result cards: portrait block plus name/meta lines. */
export function CardListSkeleton({ testID, label, style, cards = 3 }: PlaceholderProps & { cards?: number }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label} style={[styles.cardList, style]}>
      {Array.from({ length: cards }, (_, index) => (
        <View key={index} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Skeleton style={styles.cardImage} />
          <View style={styles.rowText}>
            <Skeleton style={styles.rowTitle} />
            <Skeleton style={styles.rowMeta} />
            <Skeleton style={styles.cardPrice} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Alternating message bubbles, newest at the bottom like the real thread. */
export function ConversationSkeleton({ testID, label, style }: PlaceholderProps) {
  const widths = ['62%', '48%', '70%', '40%'] as const;
  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={label} style={[styles.thread, style]}>
      {widths.map((width, index) => (
        <Skeleton
          key={index}
          style={[styles.bubble, { width, alignSelf: index % 2 === 0 ? 'flex-start' : 'flex-end' }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md },
  fieldLabel: { width: 96, height: 14 },
  field: { height: 52, borderRadius: radius.md },
  fieldMultiline: { height: 160 },
  helper: { width: '55%', height: 12 },
  action: { height: 52, borderRadius: radius.md, marginTop: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: HAIRLINE,
    borderRadius: radius.sm,
    padding: space.base,
    marginTop: space.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: space.sm },
  rowTitle: { width: '60%', height: 16 },
  rowMeta: { width: '40%', height: 12 },
  rowAction: { width: 44, height: 32, borderRadius: radius.sm },
  statusCard: { borderWidth: HAIRLINE, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  statusPill: { width: 96, height: 24, borderRadius: 12 },
  statusLine: { width: '85%', height: 14 },
  statusLineShort: { width: '55%', height: 14 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: HAIRLINE,
    paddingVertical: space.base,
    marginTop: space.sm,
  },
  docIcon: { width: 40, height: 40, borderRadius: radius.sm },
  cardList: { paddingHorizontal: space.xl, paddingTop: space.base, gap: space.md },
  card: { flexDirection: 'row', gap: space.md, borderWidth: HAIRLINE, borderRadius: radius.md, padding: space.md },
  cardImage: { width: 72, height: 72, borderRadius: radius.sm },
  cardPrice: { width: 56, height: 14 },
  thread: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.base, paddingBottom: space.base, gap: space.sm },
  bubble: { height: 40, borderRadius: radius.lg },
});
