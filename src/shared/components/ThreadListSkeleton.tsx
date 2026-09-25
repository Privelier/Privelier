import { StyleSheet, View } from 'react-native';
import { HAIRLINE } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { Skeleton } from './Skeleton';

/** Conversation-preview placeholders shared by the separate role inboxes. */
export function ThreadListSkeleton({ testID }: { testID: string }) {
  const { colors } = useTheme();

  return (
    <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel="Loading conversations" style={styles.list}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.row, index > 0 && { borderTopWidth: HAIRLINE, borderTopColor: colors.border }]}>
          <Skeleton style={styles.avatar} />
          <View style={styles.info}>
            <Skeleton style={styles.name} />
            <Skeleton style={styles.preview} />
          </View>
          <Skeleton style={styles.date} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 16, paddingBottom: 32 },
  row: { minHeight: 80, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  info: { flex: 1, minWidth: 0, gap: 8 },
  name: { width: '60%', height: 17 },
  preview: { width: '85%', height: 12 },
  date: { width: 36, height: 11 },
});
