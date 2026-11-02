/**
 * "Is this your cut?" (Looks S2). Opened from the look_confirm notification
 * (feed row or push) for one booking. The client confirms or declines that
 * the photos show their cut and, separately, whether the look may be shown
 * to signed-in clients in the city. Not showing keeps it as proof without a
 * photo; both can be taken back at any time. Faces are never wanted (L1):
 * a recognizable face is a reason to decline or report.
 *
 * Maestro contract: customer-look-confirm-screen / -back / -photo-{n} /
 * -mine-yes / -mine-no / -show-yes / -show-no / -status / -hide /
 * -withdraw / -report / -error.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { Notice } from '../../shared/components/Notice';
import { PortfolioGrid } from '../../shared/components/PortfolioGrid';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { LookPhotoTile } from '../../looks/components/LookPhotoTile';
import { styleList, type LookStage } from '../../looks/lookPresentation';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { useLookConfirm } from '../hooks/useLookConfirm';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'LookConfirm'>;

function statusCopy(stage: LookStage, de: boolean): { title: string; body: string } {
  switch (stage) {
    case 'published':
      return de
        ? { title: 'Dein Look wird gezeigt', body: 'Ohne Namen, nur in der App, für angemeldete Kunden in deiner Stadt.' }
        : { title: 'Your look is shown', body: 'Without your name, only in the app, to signed-in clients in your city.' };
    case 'confirmed':
      return de
        ? { title: 'Als dein Schnitt bestätigt', body: 'Er zählt als Beweis für deinen Barber, die Fotos werden nicht gezeigt.' }
        : { title: 'Confirmed as your cut', body: 'It counts as proof for your barber; the photos are not shown.' };
    case 'declined':
      return de
        ? { title: 'Abgelehnt', body: 'Du hast gesagt, das ist nicht dein Schnitt. Er zählt nicht.' }
        : { title: 'Declined', body: 'You said this is not your cut. It does not count.' };
    case 'withdrawn':
      return de
        ? { title: 'Zurückgezogen', body: 'Dieser Look zählt nicht mehr und wird nicht gezeigt.' }
        : { title: 'Withdrawn', body: 'This look no longer counts and is not shown.' };
    case 'expired':
      return de
        ? { title: 'Abgelaufen', body: 'Diese Anfrage ist zu alt und kann nicht mehr beantwortet werden.' }
        : { title: 'Expired', body: 'This request is too old to answer.' };
    default:
      return de
        ? { title: 'Nicht verfügbar', body: 'Dieser Look ist nicht mehr verfügbar.' }
        : { title: 'Not available', body: 'This look is no longer available.' };
  }
}

function SecondaryAction({ label, testID, onPress, disabled, danger = false }: { label: string; testID: string; onPress: () => void; disabled: boolean; danger?: boolean }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [styles.secondary, { borderColor: danger ? colors.error : colors.border, opacity: pressed ? pressOpacity.soft : disabled ? 0.6 : 1 }]}
    >
      <Text style={{ color: danger ? colors.error : colors.textPrimary, fontFamily: fonts.bodyMedium, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export default function LookConfirmScreen({ route, navigation }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors, fonts } = useTheme();
  const confirm = useLookConfirm(route.params.bookingId);
  const [mine, setMine] = useState(false);
  const { look, stage, busy } = confirm;
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };
  const heading = { color: colors.textPrimary, fontFamily: fonts.headingMedium };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-look-confirm-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-look-confirm-back" backDisabled={busy} title={de ? 'Dein Look' : 'Your look'} />
      {confirm.loading ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} accessibilityLabel={de ? 'Wird geladen' : 'Loading'} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {confirm.error ? <Notice message={confirm.error} testID="customer-look-confirm-error" style={styles.block} /> : null}
          {look && look.look_photos.length > 0 && (stage === 'awaiting_customer' || stage === 'published') ? (
            <>
              <Text style={[styles.body, muted]}>
                {de ? `Stil: ${styleList(confirm.styles, look.styles, true)}` : `Style: ${styleList(confirm.styles, look.styles, false)}`}
              </Text>
              <PortfolioGrid style={styles.block}>
                {look.look_photos.map((photo, index) => (
                  <LookPhotoTile
                    key={photo.id}
                    uri={confirm.urls.get(photo.storage_path) ?? null}
                    label={de ? `Ergebnisfoto ${index + 1}` : `Result photo ${index + 1}`}
                    testID={`customer-look-confirm-photo-${index + 1}`}
                  />
                ))}
              </PortfolioGrid>
            </>
          ) : null}

          {stage === 'awaiting_customer' && !mine ? (
            <GlassSurface style={styles.surface}>
              <Text style={[styles.title, heading]}>{de ? 'Ist das dein Schnitt?' : 'Is this your cut?'}</Text>
              <Text style={[styles.body, muted]}>
                {de ? 'Dein Barber hat das Ergebnis deines Termins festgehalten.' : 'Your barber captured the result of your appointment.'}
              </Text>
              <View style={styles.actions}>
                <PrimaryButton label={de ? 'Ja, das bin ich' : 'Yes, that is me'} onPress={() => setMine(true)} disabled={busy} testID="customer-look-confirm-mine-yes" />
                <SecondaryAction label={de ? 'Nein, nicht mein Schnitt' : 'No, not my cut'} onPress={() => void confirm.answer(false, false)} disabled={busy} testID="customer-look-confirm-mine-no" />
              </View>
            </GlassSurface>
          ) : null}

          {stage === 'awaiting_customer' && mine ? (
            <GlassSurface style={styles.surface}>
              <Text style={[styles.title, heading]}>{de ? 'Darf er gezeigt werden?' : 'May it be shown?'}</Text>
              <Text style={[styles.body, muted]}>
                {de
                  ? 'Ohne deinen Namen, nur in der App, für angemeldete Kunden in deiner Stadt. Du kannst das jederzeit beenden. Ist dein Gesicht erkennbar, wähle Nein.'
                  : 'Without your name, only in the app, to signed-in clients in your city. You can stop this at any time. If your face is recognizable, choose No.'}
              </Text>
              <View style={styles.actions}>
                <PrimaryButton label={de ? 'Ja, zeigen' : 'Yes, show it'} onPress={() => void confirm.answer(true, true)} loading={busy} testID="customer-look-confirm-show-yes" />
                <SecondaryAction label={de ? 'Nein, nur als Beweis zählen' : 'No, only count it as proof'} onPress={() => void confirm.answer(true, false)} disabled={busy} testID="customer-look-confirm-show-no" />
              </View>
            </GlassSurface>
          ) : null}

          {stage !== 'awaiting_customer' ? (
            <GlassSurface style={styles.surface} testID="customer-look-confirm-status">
              <Text style={[styles.title, heading]}>{statusCopy(stage, de).title}</Text>
              <Text style={[styles.body, muted]}>{statusCopy(stage, de).body}</Text>
              <View style={styles.actions}>
                {stage === 'published' ? (
                  <SecondaryAction label={de ? 'Nicht mehr zeigen' : 'Stop showing'} onPress={() => void confirm.takeBack('hide')} disabled={busy} testID="customer-look-confirm-hide" />
                ) : null}
                {stage === 'published' || stage === 'confirmed' ? (
                  <SecondaryAction label={de ? 'Ganz zurückziehen' : 'Withdraw completely'} onPress={() => void confirm.takeBack('withdraw')} disabled={busy} danger testID="customer-look-confirm-withdraw" />
                ) : null}
              </View>
            </GlassSurface>
          ) : null}

          {look && stage !== 'none' ? (
            <Pressable
              onPress={() => void confirm.report()}
              disabled={busy || confirm.reported}
              accessibilityRole="button"
              accessibilityLabel={de ? 'Foto melden' : 'Report photo'}
              testID="customer-look-confirm-report"
              style={({ pressed }) => [styles.report, { opacity: pressed ? pressOpacity.soft : 1 }]}
            >
              <Text style={[styles.body, muted]}>
                {confirm.reported
                  ? (de ? 'Gemeldet. Wir prüfen das innerhalb von 24 Stunden.' : 'Reported. We review it within 24 hours.')
                  : (de ? 'Problem mit den Fotos? Melden' : 'Problem with the photos? Report')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { marginTop: space['2xl'] },
  content: { paddingHorizontal: space.xl, paddingTop: space.base, paddingBottom: space['2xl'] },
  block: { marginTop: space.base },
  surface: { marginTop: space.base, padding: space.base },
  title: { fontSize: 20, lineHeight: 27 },
  body: { fontSize: 14, lineHeight: 20, marginTop: space.xs },
  actions: { marginTop: space.base, gap: space.md },
  secondary: { minHeight: 52, borderRadius: radius.pill, borderWidth: HAIRLINE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.base },
  report: { minHeight: 44, justifyContent: 'center', marginTop: space.lg },
});
