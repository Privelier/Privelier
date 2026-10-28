/**
 * Barber Chats tab — rebuild of the prototype's barber.chats route: serif
 * header and a hairline-divided thread list, same anatomy as the customer
 * Inbox tab.
 *
 * Real data end to end via fetchOwnChatsView (RLS-scoped chat_rooms +
 * messages). No rooms exist until step 15-16 ships chat, so the empty
 * state is the expected first render.
 *
 * Honesty deviations from the prototype: rows use the participant-scoped
 * 0012 counterparts RPC for the customer's real display identity. Service
 * context stays visually secondary and the latest-message preview remains
 * independently visible. Tapping a thread opens the real conversation.
 *
 * Loads on FOCUS (not mount): returning from a conversation must show the
 * fresh last-message preview, and bottom-tab screens stay mounted.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { RetryNotice } from '../../shared/components/RetryNotice';
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
        title: item.counterpart?.name ?? 'Customer',
        subtitle: item.service?.name ?? null,
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

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="barber-chats-loading"
        />
      ) : error ? (
        <RetryNotice testID="barber-chats-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} />
      ) : (
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
            const name = item.counterpart?.name ?? 'Customer';
            const serviceName = item.service?.name ?? null;
            const preview = item.lastMessage?.message ?? 'No messages yet.';
            const unread = unreadRoomIds.has(item.room.id);
            return (
              <Pressable
                onPress={() => onOpenThread(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${name}${serviceName ? ` about ${serviceName}` : ''}`}
                testID={`barber-chats-row-${item.room.id}`}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 ? { borderTopWidth: HAIRLINE, borderTopColor: colors.border } : null,
                  pressed ? { opacity: pressOpacity.soft } : null,
                ]}
              >
                {item.counterpart?.profile_image ? (
                  <Image source={{ uri: item.counterpart.profile_image }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.avatarInitial, { color: colors.textSecondary, fontFamily: fonts.headingMedium }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
                    testID={`barber-chats-name-${item.room.id}`}
                  >
                    {name}
                    {serviceName ? (
                      <Text
                        style={[styles.rowService, { color: colors.textSecondary, fontFamily: fonts.body }]}
                        testID={`barber-chats-service-${item.room.id}`}
                      >
                        {` · ${serviceName}`}
                      </Text>
                    ) : null}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.rowPreview,
                      unread
                        ? { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }
                        : { color: colors.textSecondary, fontFamily: fonts.body },
                    ]}
                    testID={`barber-chats-preview-${item.room.id}`}
                  >
                    {preview}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 30, marginTop: space.xl, paddingHorizontal: space.xl },

  spinner: { marginTop: 48 },
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
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16 },
  rowService: { fontSize: 12 },
  rowPreview: { fontSize: 12, marginTop: 3 },
  rowDate: { fontSize: 10 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
