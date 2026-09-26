/**
 * Customer Inbox tab — rebuild of the prototype's customer.inbox route:
 * serif header with the "Conversations with your barbers." subtitle and a
 * hairline-divided thread list (round avatar, barber name, preview line,
 * compact date on the right).
 *
 * Real data end to end via fetchOwnInboxView (RLS scopes chat_rooms and
 * messages to the caller's own threads). Until step 15-16 ships chat there
 * are no rooms, so the empty state is the expected first render.
 *
 * Honesty deviations from the prototype: no fake "online" presence dot
 * (there is no presence system), and the preview line is the real latest
 * message — falling back to "About: {service}" booking context, which is
 * all the prototype ever showed — instead of mocked message text. Tapping
 * a thread opens the real conversation screen (step 15-16), carrying the
 * row's already-loaded barber/service context as the header.
 *
 * Loads on FOCUS (not mount): returning from a conversation must show the
 * fresh last-message preview, and bottom-tab screens stay mounted.
 */
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { pressOpacity } from '../../theme/motion';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { Avatar } from '../../shared/components/Avatar';
import { ThreadListSkeleton } from '../../shared/components/ThreadListSkeleton';
import type { InboxThread } from '../types';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';
import { fetchOwnInboxView } from '../inboxData';
import { formatShortDate } from '../format';
import { useUnread } from '../UnreadContext';
import { formatBookingWhen } from '../../shared/format';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Inbox'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export default function InboxScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  // Real per-user read state (provider in CustomerNavigator): unread rows
  // render bold with a brass dot; the set updates live via realtime.
  const { unreadRoomIds } = useUnread();

  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOwnInboxView();
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
        title: item.barber?.name ?? 'Barber',
        subtitle: [item.service?.name, item.booking ? formatBookingWhen(item.booking.date, item.booking.time) : null].filter(Boolean).join(' · ') || null,
        counterpart: item.barber ? { id: item.barber.id, name: item.barber.name, profile_image: item.barber.profile_image } : null,
      });
    },
    [navigation]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-inbox-screen"
    >
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Inbox
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          Conversations with your barbers.
        </Text>
      </View>

      {loading && threads.length === 0 ? (
        <ThreadListSkeleton testID="customer-inbox-loading" />
      ) : error && threads.length === 0 ? (
        <RetryNotice testID="customer-inbox-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} />
      ) : (
        <>
        {error ? <RetryNotice testID="customer-inbox-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} /> : null}
        <FlatList
          testID="customer-inbox-list"
          data={threads}
          keyExtractor={(item) => item.room.id}
          refreshControl={
            <RefreshControl
              refreshing={loading && threads.length > 0}
              onRefresh={() => void load()}
              progressViewOffset={12}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text
                style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
                testID="customer-inbox-empty"
              >
                No messages yet.
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Conversations start once you book a barber.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const name = item.barber?.name ?? 'Barber';
            const preview =
              item.lastMessage?.message ??
              (item.service ? `About: ${item.service.name}` : 'No messages yet.');
            const unread = unreadRoomIds.has(item.room.id);
            return (
              <Pressable
                onPress={() => onOpenThread(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${name}`}
                testID={`customer-inbox-row-${item.room.id}`}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 ? { borderTopWidth: 0.5, borderTopColor: colors.border } : null,
                  pressed ? { opacity: pressOpacity.soft } : null,
                ]}
              >
                <Avatar
                  id={item.barber?.id ?? item.room.barber_id}
                  name={item.barber?.name}
                  imageUrl={item.barber?.profile_image}
                  size={48}
                  accessible={false}
                  testID={`customer-inbox-avatar-${item.room.id}`}
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
                    testID={`customer-inbox-unread-${item.room.id}`}
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
  header: { paddingHorizontal: 24, marginTop: 24 },
  heading: { fontSize: 30 },
  subtitle: { fontSize: 12, marginTop: 4 },

  noticeMargins: { marginTop: 24, marginHorizontal: 24 },

  listContent: { paddingTop: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyText: { fontSize: 13 },
  emptyHint: { fontSize: 12, marginTop: 6 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16 },
  rowPreview: { fontSize: 12, marginTop: 3 },
  rowDate: { fontSize: 10 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
