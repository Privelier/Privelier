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
 * a thread explains that chat opens with a later update (step 15-16),
 * same pattern as the profile screen's Book button.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import type { InboxThread } from '../types';
import { fetchOwnInboxView } from '../inboxData';
import { formatShortDate } from '../format';

export default function InboxScreen() {
  const { colors, fonts } = useTheme();

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

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly) for the same
    // react-hooks/set-state-in-effect reason as the other data screens.
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const onOpenThread = useCallback(() => {
    Alert.alert('Chat opens soon', 'Messaging is coming in an upcoming update.');
  }, []);

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

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="customer-inbox-loading"
        />
      ) : error ? (
        <View
          testID="customer-inbox-error"
          accessibilityRole="alert"
          style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.room.id}
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
            return (
              <Pressable
                onPress={onOpenThread}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${name}`}
                testID={`customer-inbox-row-${item.room.id}`}
                style={[
                  styles.row,
                  index > 0 ? { borderTopWidth: 0.5, borderTopColor: colors.border } : null,
                ]}
              >
                {item.barber?.profile_image ? (
                  <Image source={{ uri: item.barber.profile_image }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.avatarInitial, { color: colors.textSecondary, fontFamily: fonts.headingMedium }]}>
                      {name.trim().charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
                  >
                    {name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowPreview, { color: colors.textSecondary, fontFamily: fonts.body }]}
                  >
                    {preview}
                  </Text>
                </View>
                {item.lastActivityIso ? (
                  <Text style={[styles.rowDate, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {formatShortDate(item.lastActivityIso)}
                  </Text>
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
  header: { paddingHorizontal: 24, marginTop: 24 },
  heading: { fontSize: 24 },
  subtitle: { fontSize: 12, marginTop: 4 },

  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24, marginHorizontal: 24 },
  noticeText: { fontSize: 14 },

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
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16 },
  rowPreview: { fontSize: 12, marginTop: 3 },
  rowDate: { fontSize: 10 },
});
