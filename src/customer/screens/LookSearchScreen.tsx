/**
 * Look search (Looks S4, flag-gated, opened from the Discover looks rail).
 * The client picks a style, a day and a time window, optionally adds their
 * own photo, and sees at once who has proven that style and is free then,
 * best exact-hit rate first. "Book" goes straight to the address step of the
 * normal booking flow with that time; the style and photo ride along as the
 * reference. Never shows a barber's location or a distance.
 *
 * Maestro contract: customer-look-search-screen / -back / -style-{key} /
 * -day-{n} / -window-{key} / -photo-add / -photo / -photo-remove / -search /
 * -results / -empty / -wish / -wishes / -match-{barberId} / -book-{barberId} /
 * -error.
 */
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GlassChip } from '../../shared/components/GlassChip';
import { Notice } from '../../shared/components/Notice';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { LookPhotoTile } from '../../looks/components/LookPhotoTile';
import { styleList } from '../../looks/lookPresentation';
import { matchProofLine, SEARCH_WINDOWS } from '../../looks/searchPresentation';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import CalendarDateStrip from '../components/CalendarDateStrip';
import { LookOfferCard } from '../components/looks/LookOfferCard';
import { useLookSearch } from '../hooks/useLookSearch';
import { openLookBooking } from '../lookBooking';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'LookSearch'>;

const NO_DISABLED_DAYS: ReadonlySet<string> = new Set();

export default function LookSearchScreen({ route, navigation }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors, fonts } = useTheme();
  const search = useLookSearch(route.params?.style);
  const label = [styles.label, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }];
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };
  const styleName = search.style ? styleList(search.styles, [search.style], de) : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-look-search-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-look-search-back" title={de ? 'Look suchen' : 'Find a look'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={label}>{de ? 'Welcher Stil?' : 'Which style?'}</Text>
        <View style={styles.chips}>
          {search.styles.map((style) => (
            <GlassChip key={style.key} label={de ? style.label_de : style.label_en} selected={search.style === style.key} onPress={() => search.setStyle(style.key)} size="compact" testID={`customer-look-search-style-${style.key}`} />
          ))}
        </View>

        <Text style={label}>{de ? 'Wann?' : 'When?'}</Text>
        <CalendarDateStrip dates={search.days} disabledDates={NO_DISABLED_DAYS} selectedDate={search.day} onSelectDate={search.setDay} testIDPrefix="customer-look-search" />
        <View style={[styles.chips, styles.gapTop]}>
          {SEARCH_WINDOWS.map((window) => (
            <GlassChip key={window.key} label={de ? window.label_de : window.label_en} selected={search.window.key === window.key} onPress={() => search.setWindow(window)} size="compact" testID={`customer-look-search-window-${window.key}`} />
          ))}
        </View>

        <Text style={label}>{de ? 'Dein Foto (optional)' : 'Your photo (optional)'}</Text>
        <Text style={[styles.body, muted]}>{de ? 'Geht nur an den Barber, den du buchst, oder bei einem Wunsch an die Barber, die antworten dürfen. Nie öffentlich.' : 'Goes only to the barber you book, or for a wish to the barbers who may answer it. Never public.'}</Text>
        {search.photo ? (
          <View style={[styles.photo, styles.gapTop]}>
            <LookPhotoTile uri={search.photo.uri} label={de ? 'Dein Referenzfoto' : 'Your reference photo'} testID="customer-look-search-photo" onRemove={search.removePhoto} removeLabel={de ? 'Foto entfernen' : 'Remove photo'} />
          </View>
        ) : (
          <Pressable
            onPress={() => void search.addPhoto()}
            disabled={search.busy}
            accessibilityRole="button"
            accessibilityLabel={de ? 'Eigenes Foto hinzufügen' : 'Add your own photo'}
            testID="customer-look-search-photo-add"
            style={({ pressed }) => [styles.addPhoto, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
          >
            <Feather name="image" size={18} color={colors.accentText} />
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 }}>{de ? 'Foto hinzufügen' : 'Add photo'}</Text>
          </Pressable>
        )}

        {search.error ? <Notice message={search.error} testID="customer-look-search-error" style={styles.gapTop} /> : null}

        {search.matches !== null ? (
          <View testID="customer-look-search-results" style={styles.results}>
            <Text style={label}>{de ? `Frei und bewiesen: ${styleName}` : `Free and proven: ${styleName}`}</Text>
            {search.matches.length === 0 ? (
              <>
                <Notice
                  variant="info"
                  testID="customer-look-search-empty"
                  message={de
                    ? 'Niemand mit Beweis in diesem Stil ist dann frei. Schick es als Wunsch: Barber in deiner Stadt mit diesem Stil schlagen dir eine Zeit vor, zum normalen Preis.'
                    : 'Nobody with proof in this style is free then. Send it as a wish: barbers in your city with this style suggest a time, at their normal price.'}
                />
                <Pressable
                  onPress={() => void search.sendWish().then((sent) => { if (sent) navigation.replace('LookWishes'); })}
                  disabled={search.busy}
                  accessibilityRole="button"
                  accessibilityLabel={de ? 'Als Wunsch senden' : 'Send as a wish'}
                  testID="customer-look-search-wish"
                  style={({ pressed }) => [styles.book, { borderColor: colors.accent, opacity: pressed ? pressOpacity.soft : 1 }]}
                >
                  <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{de ? 'Als Wunsch senden' : 'Send as a wish'}</Text>
                </Pressable>
              </>
            ) : null}
            {search.matches.map((match) => (
              <LookOfferCard
                key={match.barber_id}
                name={match.barber_name}
                proofLine={matchProofLine(match, styleName, de)}
                serviceName={match.service_name}
                price={match.service_price}
                time={match.first_free_time}
                de={de}
                testID={`customer-look-search-match-${match.barber_id}`}
                bookTestID={`customer-look-search-book-${match.barber_id}`}
                onBook={() => void search.serviceFor(match).then((service) => openLookBooking(navigation, {
                  barberId: match.barber_id,
                  barberName: match.barber_name,
                  barberImage: match.barber_image,
                  service,
                  date: search.day,
                  time: match.first_free_time,
                  lookReference: { lookId: null, style: search.style ?? '', photoPath: search.photo?.path ?? null },
                }))}
              />
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => navigation.navigate('LookWishes')}
          accessibilityRole="button"
          accessibilityLabel={de ? 'Meine Look-Wünsche und Angebote' : 'My look wishes and offers'}
          testID="customer-look-search-wishes"
          style={({ pressed }) => [styles.link, { opacity: pressed ? pressOpacity.soft : 1 }]}
        >
          <Text style={{ color: colors.textSecondary, fontFamily: fonts.bodyMedium, fontSize: 14 }}>{de ? 'Meine Wünsche und Angebote' : 'My wishes and offers'}</Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {search.busy && search.matches === null ? <ActivityIndicator color={colors.accent} style={styles.spinner} accessibilityLabel={de ? 'Suche läuft' : 'Searching'} /> : null}
        <PrimaryButton label={de ? 'Freie Barber finden' : 'Find free barbers'} onPress={() => void search.search()} disabled={!search.style} loading={search.busy} testID="customer-look-search-search" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['2xl'] },
  label: { fontSize: 15, marginTop: space.xl, marginBottom: space.sm },
  body: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gapTop: { marginTop: space.md },
  photo: { width: '47%' },
  addPhoto: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: HAIRLINE, borderRadius: radius.md, paddingHorizontal: space.base, marginTop: space.md },
  results: { marginTop: space.sm },
  book: { minHeight: 44, borderWidth: HAIRLINE, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  link: { minHeight: 44, justifyContent: 'center', marginTop: space.lg },
  footer: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: 20, borderTopWidth: HAIRLINE },
  spinner: { marginBottom: space.sm },
});
