/**
 * In a pending or accepted booking's details (Looks S3, flag-gated): when
 * the client booked from one of this barber's looks, say which style they
 * want. Renders nothing for an ordinary booking.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchLookReference, fetchLookStyles } from '../../../looks/looksData';
import { styleList } from '../../../looks/lookPresentation';
import { HAIRLINE, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export function LookReferenceNote({ bookingId, de }: { bookingId: string; de: boolean }) {
  const { colors, fonts } = useTheme();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchLookReference(bookingId), fetchLookStyles()]).then(([reference, styles]) => {
      if (!active || reference.status !== 'ok' || !reference.value) return;
      setLabel(styleList(styles.status === 'ok' ? styles.value : [], [reference.value.style], de));
    });
    return () => {
      active = false;
    };
  }, [bookingId, de]);

  if (!label) return null;
  return (
    <View style={[styles.row, { borderColor: colors.border }]} testID={`barber-look-reference-${bookingId}`} accessible accessibilityLabel={de ? `Gebucht über deinen Look: ${label}` : `Booked from your look: ${label}`}>
      <Feather name="scissors" size={16} color={colors.accentText} />
      <Text style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 }}>
        {de ? `Gebucht über deinen Look: ${label}` : `Booked from your look: ${label}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: HAIRLINE, marginTop: space.base, paddingTop: space.md },
});
