import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius } from '../../theme/spacing';
import { Skeleton } from './Skeleton';

/** Content-shaped first-load state for both booking lists. */
export function BookingListSkeleton({ testID, avatarSize = 48 }: { testID: string; avatarSize?: number }) {
  const { colors } = useTheme();

  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel="Loading bookings" style={styles.list}>
      {[0, 1].map((index) => (
        <View
          key={index}
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <View style={styles.row}>
            <Skeleton style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }} />
            <View style={styles.details}>
              <Skeleton style={styles.name} />
              <Skeleton style={styles.meta} />
            </View>
            <Skeleton style={styles.price} />
          </View>
          <View style={styles.footer}>
            <Skeleton style={styles.date} />
            <Skeleton style={styles.status} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  card: { borderWidth: HAIRLINE, borderRadius: radius.sm, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  details: { flex: 1, minWidth: 0, gap: 8 },
  name: { width: '65%', height: 18 },
  meta: { width: '45%', height: 12 },
  price: { width: 46, height: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  date: { width: 110, height: 12 },
  status: { width: 70, height: 24, borderRadius: 12 },
});
