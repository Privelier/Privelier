/**
 * In a pending or accepted booking's details (Looks S3/S4, flag-gated): when
 * the client booked from one of this barber's looks or through a look
 * search, say which style they want and show their private reference photo
 * (signed, short-lived; the server ends access with the request). Renders
 * nothing for an ordinary booking.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LookPhotoTile } from '../../../looks/components/LookPhotoTile';
import { fetchLookReference, fetchLookStyles, signReferencePhoto } from '../../../looks/looksData';
import { styleList } from '../../../looks/lookPresentation';
import { HAIRLINE, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export function LookReferenceNote({ bookingId, de }: { bookingId: string; de: boolean }) {
  const { colors, fonts } = useTheme();
  const [note, setNote] = useState<{ text: string; photoUri: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchLookReference(bookingId), fetchLookStyles()]).then(async ([reference, styles]) => {
      if (!active || reference.status !== 'ok' || !reference.value) return;
      const { look_id: lookId, style, photo_path: photoPath } = reference.value;
      const label = styleList(styles.status === 'ok' ? styles.value : [], [style], de);
      const text = lookId
        ? (de ? `Gebucht über deinen Look: ${label}` : `Booked from your look: ${label}`)
        : (de ? `Gebucht über die Look-Suche: ${label}` : `Booked through look search: ${label}`);
      const photoUri = photoPath ? await signReferencePhoto(photoPath) : null;
      if (active) setNote({ text, photoUri });
    });
    return () => {
      active = false;
    };
  }, [bookingId, de]);

  if (!note) return null;
  return (
    <View style={[styles.block, { borderColor: colors.border }]}>
      <View style={styles.row} testID={`barber-look-reference-${bookingId}`} accessible accessibilityLabel={note.text}>
        <Feather name="scissors" size={16} color={colors.accentText} />
        <Text style={{ flex: 1, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 }}>{note.text}</Text>
      </View>
      {note.photoUri ? (
        <View style={styles.photo}>
          <LookPhotoTile uri={note.photoUri} label={de ? 'Referenzfoto des Kunden, nur für dich' : 'Client reference photo, only for you'} testID={`barber-look-reference-photo-${bookingId}`} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderTopWidth: HAIRLINE, marginTop: space.base, paddingTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  photo: { width: '47%', marginTop: space.md },
});
