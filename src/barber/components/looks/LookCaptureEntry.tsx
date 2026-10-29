/**
 * The Looks entry inside a completed booking's details (Requests tab, only
 * while the 'looks' flag is on): where this booking's look stands, and the
 * way into the capture screen.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchLookForBooking } from '../../../looks/looksData';
import { barberLookStatus, lookStage, type LookStage } from '../../../looks/lookPresentation';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export function LookCaptureEntry({ bookingId, de, onOpen }: { bookingId: string; de: boolean; onOpen: () => void }) {
  const { colors, fonts } = useTheme();
  const [stage, setStage] = useState<LookStage | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLookForBooking(bookingId).then((result) => {
      if (active) setStage(result.status === 'ok' ? lookStage(result.value) : 'none');
    });
    return () => {
      active = false;
    };
  }, [bookingId]);

  if (stage === null) return null;
  const status = barberLookStatus(stage, de);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${status.title}. ${status.body}`}
      testID={`barber-look-entry-${bookingId}`}
      style={({ pressed }) => [styles.row, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <Feather name="camera" size={18} color={colors.accentText} />
      <View style={styles.copy}>
        <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{status.title}</Text>
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 }}>{status.body}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: HAIRLINE, marginTop: space.base, paddingTop: space.md },
  copy: { flex: 1, gap: 2 },
});
