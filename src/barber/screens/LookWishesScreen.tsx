/**
 * Look wishes in the barber's city (Looks S5, flag-gated). Opened from the
 * Requests header and from a look_wish notification or push. Lists open
 * wishes for styles this barber has proven, without the client's identity;
 * the barber picks one of their services and a start inside the window,
 * adds a short note and sends an offer at the service's normal price. An
 * accepted offer arrives as a normal request in Requests.
 *
 * Maestro contract: barber-look-wishes-screen / -back / -empty /
 * -wish-{id} / -photo-{id} / -service-{id}-{serviceId} / -time-{id}-{HHMM} /
 * -note-{id} / -send-{id} / -withdraw-{id} / -report-{id} / -error-{id}.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState } from '../../shared/components/EmptyState';
import { GlassChip } from '../../shared/components/GlassChip';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { Notice } from '../../shared/components/Notice';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ReportSheet } from '../../shared/components/ReportSheet';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { formatMoney } from '../../shared/format';
import { getAppLanguage } from '../../shared/locale';
import { LookPhotoTile } from '../../looks/components/LookPhotoTile';
import { styleList } from '../../looks/lookPresentation';
import { offerStarts, shortTime, wishStatusLine, wishWindowLine } from '../../looks/searchPresentation';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { useBarberWishes } from '../hooks/useBarberWishes';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'LookWishes'>;

const NOTE_MAX = 280;

export default function LookWishesScreen({ navigation }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors, fonts, isDark } = useTheme();
  const data = useBarberWishes();
  const [reporting, setReporting] = useState<string | null>(null);
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };
  const label = [styles.label, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="barber-look-wishes-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="barber-look-wishes-back" title={de ? 'Look-Wünsche' : 'Look wishes'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.body, muted]}>
          {de
            ? 'Kunden in deiner Stadt suchen einen Look, den du nachweislich geschnitten hast. Schlag eine Zeit vor, der Preis ist dein normaler Service-Preis.'
            : 'Clients in your city want a look you have proven. Suggest a time; the price is your normal service price.'}
        </Text>
        {data.loadError ? <Notice message={data.loadError} testID="barber-look-wishes-error" style={styles.gap} /> : null}
        {data.wishes !== null && data.wishes.length === 0 ? (
          <EmptyState
            icon="scissors"
            testID="barber-look-wishes-empty"
            title={de ? 'Gerade keine Wünsche.' : 'No wishes right now.'}
            body={de ? 'Wünsche erscheinen hier und als Benachrichtigung, sobald ein Kunde einen deiner bewiesenen Stile sucht.' : 'Wishes appear here and as a notification when a client looks for one of your proven styles.'}
          />
        ) : null}
        {(data.wishes ?? []).map((wish) => {
          const draft = data.draftFor(wish);
          const service = data.services.find((row) => row.id === draft.serviceId) ?? null;
          const starts = service ? offerStarts(wish.window_from, wish.window_to, service.duration_minutes) : [];
          const busy = data.busyId === wish.wish_id;
          const error = data.errorFor(wish.wish_id);
          return (
            <GlassSurface key={wish.wish_id} style={styles.wish} testID={`barber-look-wishes-wish-${wish.wish_id}`}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 16 }}>{styleList(data.styles, [wish.style], de)}</Text>
              <Text style={[styles.body, muted]}>{wishWindowLine(wish, de)}</Text>
              <Text style={[styles.body, muted]}>{wishStatusLine({ status: 'open', expires_at: wish.expires_at }, de)}</Text>
              {data.photos[wish.wish_id] ? (
                <View style={styles.photo}>
                  <LookPhotoTile uri={data.photos[wish.wish_id]} label={de ? 'Referenzfoto des Kunden' : 'Client reference photo'} testID={`barber-look-wishes-photo-${wish.wish_id}`} />
                </View>
              ) : null}
              {wish.my_offer_status === 'open' && wish.my_offer_time ? (
                <Text style={[styles.body, styles.gap, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                  {de ? `Dein Angebot: ${shortTime(wish.my_offer_time)}. Du kannst es ändern.` : `Your offer: ${shortTime(wish.my_offer_time)}. You can change it.`}
                </Text>
              ) : null}

              <Text style={label}>{de ? 'Service' : 'Service'}</Text>
              <View style={styles.chips}>
                {data.services.map((row) => (
                  <GlassChip
                    key={row.id}
                    label={`${row.name} · ${formatMoney(row.price)}`}
                    selected={draft.serviceId === row.id}
                    onPress={() => data.editDraft(wish, { serviceId: row.id, time: null })}
                    size="compact"
                    testID={`barber-look-wishes-service-${wish.wish_id}-${row.id}`}
                  />
                ))}
              </View>
              {service ? (
                <>
                  <Text style={label}>{de ? 'Beginn' : 'Start'}</Text>
                  {starts.length === 0 ? (
                    <Text style={[styles.body, muted]}>{de ? 'Dieser Service passt nicht ins Fenster.' : 'This service does not fit the window.'}</Text>
                  ) : null}
                  <View style={styles.chips}>
                    {starts.map((start) => (
                      <GlassChip
                        key={start}
                        label={shortTime(start)}
                        selected={draft.time === start}
                        onPress={() => data.editDraft(wish, { time: start })}
                        size="compact"
                        testID={`barber-look-wishes-time-${wish.wish_id}-${start.slice(0, 5).replace(':', '')}`}
                      />
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={label}>{de ? 'Kurze Notiz (optional)' : 'Short note (optional)'}</Text>
              <TextInput
                value={draft.note}
                onChangeText={(note) => data.editDraft(wish, { note })}
                editable={!busy}
                multiline
                maxLength={NOTE_MAX}
                placeholder={de ? 'Zum Beispiel: Skin Fade mit sauberer Kontur' : 'For example: skin fade with a clean line-up'}
                placeholderTextColor={colors.textSecondary}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                accessibilityLabel={de ? 'Notiz an den Kunden' : 'Note to the client'}
                testID={`barber-look-wishes-note-${wish.wish_id}`}
                style={[styles.note, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface, fontFamily: fonts.body }]}
              />
              {error ? <Notice message={error} testID={`barber-look-wishes-error-${wish.wish_id}`} style={styles.gap} /> : null}
              <View style={styles.gap}>
                <PrimaryButton
                  label={wish.my_offer_status === 'open' ? (de ? 'Angebot ändern' : 'Update offer') : (de ? 'Angebot senden' : 'Send offer')}
                  onPress={() => void data.send(wish)}
                  disabled={!draft.serviceId || !draft.time}
                  loading={busy}
                  testID={`barber-look-wishes-send-${wish.wish_id}`}
                />
              </View>
              <View style={styles.links}>
                {wish.my_offer_status === 'open' ? (
                  <Pressable
                    onPress={() => void data.withdraw(wish)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={de ? 'Angebot zurückziehen' : 'Withdraw offer'}
                    testID={`barber-look-wishes-withdraw-${wish.wish_id}`}
                    style={({ pressed }) => [styles.link, { opacity: pressed ? pressOpacity.soft : 1 }]}
                  >
                    <Text style={[styles.linkText, muted]}>{de ? 'Angebot zurückziehen' : 'Withdraw offer'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setReporting(wish.wish_id)}
                  accessibilityRole="button"
                  accessibilityLabel={de ? 'Wunsch melden' : 'Report wish'}
                  testID={`barber-look-wishes-report-${wish.wish_id}`}
                  style={({ pressed }) => [styles.link, { opacity: pressed ? pressOpacity.soft : 1 }]}
                >
                  <Text style={[styles.linkText, muted]}>{de ? 'Melden' : 'Report'}</Text>
                </Pressable>
              </View>
            </GlassSurface>
          );
        })}
      </ScrollView>
      {reporting ? (
        <ReportSheet open target={{ type: 'wish', wishId: reporting }} onClose={() => setReporting(null)} testIDPrefix="barber-look-wishes" />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['2xl'] },
  wish: { marginTop: space.md, padding: space.base },
  body: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  label: { fontSize: 14, marginTop: space.base, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gap: { marginTop: space.md },
  photo: { width: '47%', marginTop: space.md },
  note: { borderWidth: HAIRLINE, borderRadius: radius.md, padding: 14, fontSize: 15, minHeight: 88, textAlignVertical: 'top' },
  links: { flexDirection: 'row', gap: space.lg },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14 },
});
