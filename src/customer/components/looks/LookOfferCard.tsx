/**
 * One bookable barber for a look (Looks S4/S5): a search match or a wish
 * offer. Name, proof, service and price on the left, the start time on the
 * right, an optional note from the barber, and "Book at HH:MM". Never a
 * location or distance.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { formatMoney } from '../../../shared/format';
import { shortTime } from '../../../looks/searchPresentation';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export function LookOfferCard({ name, proofLine, serviceName, price, time, note, de, onBook, testID, bookTestID, children }: {
  name: string | null;
  proofLine: string;
  serviceName: string;
  price: number;
  /** 'HH:MM:SS' wall-clock start. */
  time: string;
  note?: string | null;
  de: boolean;
  onBook: () => void;
  testID: string;
  bookTestID: string;
  children?: ReactNode;
}) {
  const { colors, fonts } = useTheme();
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };
  const clock = shortTime(time);
  return (
    <GlassSurface style={styles.card} testID={testID}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}>{name}</Text>
          <Text style={[styles.body, muted]}>{proofLine}</Text>
          <Text style={[styles.body, muted]}>{`${serviceName} · ${formatMoney(price)}`}</Text>
        </View>
        <Text style={{ color: colors.accentText, fontFamily: fonts.bodySemiBold, fontSize: 18 }}>{clock}</Text>
      </View>
      {note ? <Text style={[styles.note, { color: colors.textPrimary, fontFamily: fonts.body }]}>{de ? `„${note}“` : `“${note}”`}</Text> : null}
      <Pressable
        onPress={onBook}
        accessibilityRole="button"
        accessibilityLabel={de ? `${name ?? 'Barber'} um ${clock} buchen` : `Book ${name ?? 'barber'} at ${clock}`}
        testID={bookTestID}
        style={({ pressed }) => [styles.book, { borderColor: colors.accent, opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{de ? `Um ${clock} buchen` : `Book at ${clock}`}</Text>
      </Pressable>
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, padding: space.base },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1 },
  body: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  note: { fontSize: 14, lineHeight: 20, marginTop: space.sm },
  book: { minHeight: 44, borderWidth: HAIRLINE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
});
