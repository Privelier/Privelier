/**
 * Barber Chats tab — rebuild of the prototype's barber.chats route: serif
 * header and a hairline-divided thread list, same anatomy as the customer
 * Inbox tab.
 *
 * Real data end to end via fetchOwnChatsView (RLS-scoped chat_rooms +
 * messages). No rooms exist until step 15-16 ships chat, so the empty
 * state is the expected first render.
 *
 * Counterpart identity is resolved through the narrow 0012 RPC. Tapping a
 * thread opens the real conversation screen (step 15-16).
 *
 * Loads on FOCUS (not mount): returning from a conversation must show the
 * fresh last-message preview, and bottom-tab screens stay mounted.
 */
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { Avatar } from '../../shared/components/Avatar';
import { ThreadListSkeleton } from '../../shared/components/ThreadListSkeleton';
import type { InboxThread } from '../../shared/threads';
import type { BarberTabParamList } from '../BarberTabs';
import type { BarberStackParamList } from '../BarberNavigator';
import { fetchOwnChatsView } from '../chatsData';
import { formatShortDate } from '../../shared/format';
import { useUnread } from '../UnreadContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Chats'>,
  NativeStackScreenProps<BarberStackParamList>
>;

export default function ChatsScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  // Real per-user read state (provider in BarberNavigator): unread rows
  // render bold with a brass dot; the set updates live via realtime.
  const { unreadRoomIds } = useUnread();

  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOwnChatsView();
    setLoading(false);
    if (result.status === 'ok') {
      setThreads(result.threads);
    } else {
      setError(result.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onOpenThread = useCallback(
    (item: InboxThread) => {
      navigation.navigate('Conversation', {
        room: item.room,
        title: item.customer?.name ?? item.service?.name ?? 'Booking',
        subtitle: item.customer?.name ? item.service?.name ?? null : null,
      });
    },
    [navigation]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="barber-chats-screen"
    >
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        Chats
      </Text>

      {loading && threads.length === 0 ? (
        <ThreadListSkeleton testID="barber-chats-loading" />
      ) : error && threads.length === 0 ? (
        <RetryNotice testID="barber-chats-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} />
      ) : (
        <>
        {error ? <RetryNotice testID="barber-chats-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} /> : null}
        <FlatList
          data={threads}
          keyExtractor={(item) => item.room.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text
                style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
                testID="barber-chats-empty"
              >
                No conversations yet.
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Chats open once clients book you.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const name = item.customer?.name ?? 'Customer';
            const service = item.service?.name ?? 'Booking';
            const preview = item.lastMessage?.message ?? 'No messages yet.';
            const unread = unreadRoomIds.has(item.room.id);
            return (
              <Pressable
                onPress={() => onOpenThread(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${name}`}
                testID={`barber-chats-row-${item.room.id}`}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 ? { borderTopWidth: HAIRLINE, borderTopColor: colors.border } : null,
                  pressed ? { opacity: pressOpacity.soft } : null,
                ]}
              >
                <Avatar
                  id={item.customer?.id ?? item.room.customer_id}
                  name={item.customer?.name}
                  imageUrl={item.customer?.profile_image}
                  size={48}
                  accessible={false}
                  testID={`barber-chats-avatar-${item.room.id}`}
                />
                <View style={styles.rowInfo}>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
                  >
                    {name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.rowPreview,
                      unread
                        ? { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }
                        : { color: colors.textSecondary, fontFamily: fonts.body },
                    ]}
                  >
                    {item.service ? `${service} · ${preview}` : preview}
                  </Text>
                </View>
                {item.lastActivityIso ? (
                  <Text style={[styles.rowDate, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {formatShortDate(item.lastActivityIso)}
                  </Text>
                ) : null}
                {unread ? (
                  <View
                    style={[styles.unreadDot, { backgroundColor: colors.accent }]}
                    testID={`barber-chats-unread-${item.room.id}`}
                    accessible
                    accessibilityLabel="Unread messages"
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 30, marginTop: space.xl, paddingHorizontal: space.xl },

  noticeMargins: { marginTop: space.xl, marginHorizontal: space.xl },

  listContent: { paddingTop: space.base, paddingBottom: space['2xl'] },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: space.xl },
  emptyText: { fontSize: 13 },
  emptyHint: { fontSize: 12, marginTop: 6 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.base,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24, // circular disc — half its own size, computed inline (spacing.ts convention)
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16 },
  rowPreview: { fontSize: 12, marginTop: 3 },
  rowDate: { fontSize: 10 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
