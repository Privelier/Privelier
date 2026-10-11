/**
 * App-wide offline indicator for both apps and the auth shell.
 *
 * Nothing in Privelier queues work offline: a booking request, status change
 * or chat message only exists once the server accepts it. So when the device
 * reports no connection, this says exactly that instead of letting a spinner
 * or a failed send be the first signal.
 *
 * Truthfulness rules:
 * - Only a definite `false` from NetInfo counts as offline; `null` (still
 *   probing, common at launch) never shows the banner.
 * - A short settle delay keeps a momentary radio handoff from flashing it.
 * - It never claims "back online" visually; recovery is announced to screen
 *   readers only, and the banner simply leaves.
 *
 * The pill sits just below the status bar with pointerEvents="none", so it
 * never blocks a header control underneath it.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { getAppLanguage } from '../locale';

/** How long a definite offline reading must persist before it is shown. */
export const OFFLINE_SETTLE_MS = 1500;

export function OfflineBanner() {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetInfo();
  const offline = isConnected === false || isInternetReachable === false;
  const de = getAppLanguage() === 'de';

  const [visible, setVisible] = useState(false);
  const wasShownRef = useRef(false);

  useEffect(() => {
    if (!offline) {
      if (wasShownRef.current) {
        wasShownRef.current = false;
        AccessibilityInfo.announceForAccessibility(de ? 'Wieder online.' : 'Back online.');
      }
      const reset = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(() => {
      wasShownRef.current = true;
      setVisible(true);
    }, OFFLINE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [offline, de]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.anchor, { top: insets.top + space.xs }]}>
      <View
        testID="global-offline-banner"
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Feather name="wifi-off" size={14} color={colors.textSecondary} />
        <Text style={[styles.text, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
          {de
            ? 'Du bist offline. Buchungen und Nachrichten können gerade nicht gesendet werden.'
            : "You're offline. Bookings and messages can't be sent right now."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: space.base, right: space.base, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: 420,
    borderWidth: HAIRLINE,
    borderRadius: radius.pill,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
  text: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
});
