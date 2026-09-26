import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import { formatMessageTime } from '../format';
import { BackButton } from '../components/ScreenBackHeader';
import { Skeleton } from '../components/Skeleton';
import { notificationCopy, type NotificationRow } from '../notifications';

export default function NotificationCenterScreen({
  role,
  onBack,
  onOpenNotification,
}: {
  role: 'customer' | 'barber';
  onBack: () => void;
  onOpenNotification: (row: NotificationRow) => void;
}) {
  const { colors, fonts } = useTheme();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [names, setNames] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false);
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) { setLoading(false); setError(true); return; }
    setRecipientId(userId);
    const result = await supabase.from('notifications').select('*').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(100);
    setLoading(false);
    if (result.error) { setError(true); return; }
    const notifications = (result.data ?? []) as NotificationRow[];
    setRows(notifications);
    const actorIds = [...new Set(notifications.map((row) => row.actor_id).filter((id) => id !== userId))];
    if (actorIds.length === 0) { setNames({}); return; }
    const identities = role === 'customer'
      ? await supabase.from('barber_directory').select('id,name').in('id', actorIds)
      : await supabase.rpc('get_booking_counterparts', { p_booking_ids: [...new Set(notifications.map((row) => row.booking_id))] });
    if (!identities.error && identities.data) {
      const nameMap: Record<string, string | null> = {};
      for (const identity of identities.data as { user_id?: string; id?: string; name: string | null }[]) {
        const id = identity.user_id ?? identity.id;
        if (id) nameMap[id] = identity.name;
      }
      setNames(nameMap);
    }
  }, [role]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!recipientId) return undefined;
    const channel = supabase
      .channel(`notifications:${recipientId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, recipientId]);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setRows((current) => current.map((row) => row.id === id ? { ...row, read_at: now } : row));
    const result = await supabase.from('notifications').update({ read_at: now }).eq('id', id);
    if (result.error) void load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID={`${role}-notification-center`}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <BackButton onPress={onBack} accessibilityLabel="Back" testID={`${role}-notifications-back`} />
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>Booking and message updates</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" onPress={() => void load()} style={styles.refresh}>
          <Feather name="refresh-cw" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.emptyText, { color: colors.errorText }]}>Notifications could not load. Pull down to try again.</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshing={loading && rows.length > 0}
        onRefresh={() => void load()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loading ? (
          <View style={styles.skeletonList} accessibilityRole="progressbar" accessibilityLabel="Loading notifications">
            {[0, 1, 2].map((item) => <View key={item} style={styles.skeletonRow}><Skeleton style={styles.skeletonDot} /><View style={styles.skeletonCopy}><Skeleton style={styles.skeletonTitle} /><Skeleton style={styles.skeletonBody} /><Skeleton style={styles.skeletonTime} /></View></View>)}
          </View>
        ) : !error ? <View style={styles.empty}><Feather name="bell" size={24} color={colors.accent} /><Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}>You’re all caught up.</Text></View> : null}
        renderItem={({ item }) => {
          const copy = notificationCopy(item, names[item.actor_id] ?? null);
          return (
            <Pressable
              onPress={() => { if (!item.read_at) void markRead(item.id); onOpenNotification(item); }}
              accessibilityRole="button"
              accessibilityLabel={`${copy.title}. ${copy.body}${item.read_at ? '' : '. Unread'}`}
              accessibilityState={{ selected: !item.read_at }}
              testID={`${role}-notification-${item.id}`}
              style={[styles.row, { borderBottomColor: colors.border }, item.read_at ? null : { backgroundColor: colors.surface }]}
            >
              <View style={[styles.marker, { backgroundColor: item.read_at ? colors.border : colors.accent }]} />
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>{copy.title}</Text>
                <Text style={[styles.body, { color: colors.textSecondary, fontFamily: fonts.body }]}>{copy.body}</Text>
                <Text style={[styles.time, { color: colors.textSecondary, fontFamily: fonts.body }]}>{formatMessageTime(item.created_at)}</Text>
              </View>
              <Feather name={item.event_type === 'message' ? 'message-circle' : 'calendar'} size={17} color={colors.textSecondary} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderBottomWidth: 0.5 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 20 },
  subtitle: { fontSize: 12, marginTop: 2 },
  refresh: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 28, flexGrow: 1 },
  skeletonList: { paddingTop: 8 },
  skeletonRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  skeletonDot: { width: 7, height: 7, borderRadius: 4 },
  skeletonCopy: { flex: 1, gap: 7 },
  skeletonTitle: { width: 145, height: 14 },
  skeletonBody: { width: '80%', height: 12 },
  skeletonTime: { width: 52, height: 9 },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  marker: { width: 7, height: 7, borderRadius: 4 },
  copy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14 },
  body: { fontSize: 13, lineHeight: 18 },
  time: { fontSize: 11, marginTop: 2 },
  empty: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { padding: 24, textAlign: 'center', fontSize: 14 },
});
