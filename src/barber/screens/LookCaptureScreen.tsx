/**
 * Capture the result of a completed booking as a proof look (Looks S2).
 * Reached from the completed booking's details on the Requests tab, only
 * while the 'looks' flag is on. The barber tags one to three styles, picks
 * up to three photos of the back and side, confirms that no face is
 * recognizable, and sends it; the client then confirms "Is this your cut?".
 *
 * Maestro contract: barber-look-capture-screen / -back / -style-{key} /
 * -photo-{n} / -photo-{n}-remove / -add-photo / -no-face / -send / -error /
 * -status / -withdraw.
 */
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GlassChip } from '../../shared/components/GlassChip';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { Notice } from '../../shared/components/Notice';
import { PortfolioGrid, portfolioTileStyle } from '../../shared/components/PortfolioGrid';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { LookPhotoTile } from '../../looks/components/LookPhotoTile';
import { barberLookStatus, MAX_LOOK_PHOTOS, MAX_LOOK_STYLES } from '../../looks/lookPresentation';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { useLookCapture } from '../hooks/useLookCapture';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'LookCapture'>;

export default function LookCaptureScreen({ route, navigation }: Props) {
  const de = getAppLanguage() === 'de';
  const { bookingId, barberId, customerName, serviceName } = route.params;
  const { colors, fonts } = useTheme();
  const capture = useLookCapture({ bookingId, barberId, de });
  const status = barberLookStatus(capture.stage, de);
  const text = { color: colors.textPrimary, fontFamily: fonts.body };
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="barber-look-capture-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="barber-look-capture-back" backDisabled={capture.busy} title={de ? 'Ergebnis festhalten' : 'Capture the result'} />
      {capture.loading ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} accessibilityLabel={de ? 'Wird geladen' : 'Loading'} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.subtitle, muted]}>{`${customerName} · ${serviceName}`}</Text>
          {capture.error ? <Notice message={capture.error} testID="barber-look-capture-error" style={styles.block} /> : null}

          {!capture.editable ? (
            <GlassSurface style={styles.surface} testID="barber-look-capture-status">
              <Text style={[styles.statusTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{status.title}</Text>
              <Text style={[styles.body, muted]}>{status.body}</Text>
              {capture.stage === 'confirmed' || capture.stage === 'published' ? (
                <Pressable
                  onPress={() => void capture.withdraw()}
                  disabled={capture.busy}
                  accessibilityRole="button"
                  accessibilityLabel={de ? 'Look zurückziehen' : 'Withdraw look'}
                  testID="barber-look-capture-withdraw"
                  style={({ pressed }) => [styles.link, { opacity: pressed ? pressOpacity.soft : 1 }]}
                >
                  <Text style={{ color: colors.error, fontFamily: fonts.bodyMedium }}>{de ? 'Look zurückziehen' : 'Withdraw look'}</Text>
                </Pressable>
              ) : null}
            </GlassSurface>
          ) : (
            <>
              <Text style={[styles.label, text]}>{de ? `Stile (bis zu ${MAX_LOOK_STYLES})` : `Styles (up to ${MAX_LOOK_STYLES})`}</Text>
              <View style={styles.chips}>
                {capture.styles.map((style) => (
                  <GlassChip
                    key={style.key}
                    label={de ? style.label_de : style.label_en}
                    selected={capture.selected.includes(style.key)}
                    onPress={() => capture.toggle(style.key)}
                    size="compact"
                    testID={`barber-look-capture-style-${style.key}`}
                  />
                ))}
              </View>

              <Text style={[styles.label, text]}>{de ? `Fotos (bis zu ${MAX_LOOK_PHOTOS})` : `Photos (up to ${MAX_LOOK_PHOTOS})`}</Text>
              <Text style={[styles.body, muted]}>{de ? 'Nur Hinterkopf und Seite. Kein Gesicht.' : 'Back and side only. No face.'}</Text>
              <PortfolioGrid style={styles.block}>
                {capture.photos.map((item, index) => (
                  <LookPhotoTile
                    key={item.photo.id}
                    uri={item.uri}
                    label={de ? `Foto ${index + 1}` : `Photo ${index + 1}`}
                    testID={`barber-look-capture-photo-${index + 1}`}
                    onRemove={() => void capture.removePhoto(item)}
                    removeLabel={de ? `Foto ${index + 1} entfernen` : `Remove photo ${index + 1}`}
                    removeDisabled={capture.busy}
                  />
                ))}
                {capture.photos.length < MAX_LOOK_PHOTOS ? (
                  <Pressable
                    onPress={() => void capture.addPhoto()}
                    disabled={capture.busy}
                    accessibilityRole="button"
                    accessibilityLabel={de ? 'Foto hinzufügen' : 'Add photo'}
                    accessibilityState={{ disabled: capture.busy, busy: capture.busy }}
                    testID="barber-look-capture-add-photo"
                    style={({ pressed }) => [portfolioTileStyle, styles.addTile, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
                  >
                    {capture.busy ? <ActivityIndicator color={colors.accent} /> : <Feather name="plus" size={20} color={colors.accentText} />}
                    <Text style={[styles.body, muted]}>{de ? 'Foto hinzufügen' : 'Add photo'}</Text>
                  </Pressable>
                ) : null}
              </PortfolioGrid>

              <Pressable
                onPress={() => capture.setNoFace(!capture.noFace)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: capture.noFace }}
                accessibilityLabel={de ? 'Auf keinem Foto ist ein Gesicht erkennbar' : 'No face is recognizable in any photo'}
                testID="barber-look-capture-no-face"
                style={({ pressed }) => [styles.checkRow, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
              >
                <Feather name={capture.noFace ? 'check-square' : 'square'} size={20} color={capture.noFace ? colors.accentText : colors.textSecondary} />
                <Text style={[styles.checkText, text]}>{de ? 'Auf keinem Foto ist ein Gesicht erkennbar' : 'No face is recognizable in any photo'}</Text>
              </Pressable>
              <Text style={[styles.body, muted, styles.block]}>
                {de
                  ? 'Der Kunde bekommt die Fotos und entscheidet, ob es sein Schnitt ist und ob er gezeigt werden darf.'
                  : 'The client gets the photos and decides whether this is their cut and whether it may be shown.'}
              </Text>
            </>
          )}
        </ScrollView>
      )}
      {capture.editable && !capture.loading ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <PrimaryButton
            label={de ? 'An Kunden senden' : 'Send to client'}
            onPress={() => void capture.send()}
            loading={capture.busy}
            disabled={!capture.canSend}
            testID="barber-look-capture-send"
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { marginTop: space['2xl'] },
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space.xl },
  subtitle: { fontSize: 14, lineHeight: 20 },
  block: { marginTop: space.base },
  surface: { marginTop: space.base, padding: space.base },
  label: { fontSize: 15, marginTop: space.xl, marginBottom: space.sm },
  body: { fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  addTile: { borderWidth: HAIRLINE, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: HAIRLINE, borderBottomWidth: HAIRLINE, marginTop: space.xl, paddingVertical: space.md },
  checkText: { flex: 1, fontSize: 14, lineHeight: 20 },
  statusTitle: { fontSize: 20, lineHeight: 27 },
  link: { minHeight: 44, justifyContent: 'center', marginTop: space.md },
  footer: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: 20, borderTopWidth: HAIRLINE },
});
