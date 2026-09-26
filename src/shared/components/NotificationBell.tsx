import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { pressOpacity } from '../../theme/motion';
import { useTheme } from '../../theme/useTheme';
import { formatNotificationBadge } from '../notifications';

export function NotificationBell({ onPress, testID }: { onPress: () => void; testID: string }) {
  const { colors, fonts } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const badge = formatNotificationBadge(unreadCount);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let recipientId: string | null = null;
    let latestCountRequest = 0;

    const loadCount = async () => {
      if (!recipientId) return;
      const requestId = ++latestCountRequest;
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', recipientId)
        .is('read_at', null);
      if (active && !error && requestId === latestCountRequest) setUnreadCount(count ?? 0);
    };

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadCount();
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      recipientId = data.session?.user.id ?? null;
      if (!recipientId) return;
      channel = supabase
        .channel(`notification-badge:${recipientId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${recipientId}` }, () => { void loadCount(); })
        .subscribe();
      void loadCount();
    });

    return () => {
      active = false;
      appState.remove();
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
      testID={testID}
      style={({ pressed }) => [styles.button, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <Feather name="bell" size={18} color={colors.accentText} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text testID={`${testID}-badge`} style={[styles.badgeLabel, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderWidth: 0.5, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontSize: 9, lineHeight: 13 },
});
