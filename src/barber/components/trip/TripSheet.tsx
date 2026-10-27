/**
 * The trip sheet's two states. Before starting: a calm explanation of
 * exactly what is shared, with whom and for how long, then one primary
 * action (location permission is asked only on that tap, "while using").
 * While driving: the shared ETA hero and the three things a driver needs —
 * turn-by-turn in their own maps app, "I've arrived", stop sharing.
 */
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PrimaryButton } from '../../../shared/components/PrimaryButton';
import { TripStatusPanel, type TripPhase } from '../../../shared/components/trip/TripStatusPanel';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';
import type { LiveTripState, StartTripError } from '../../trip/tripService';

const ERROR_COPY: Record<'de' | 'en', Record<StartTripError, string>> = {
  de: {
    permission_denied: 'Ohne Standortzugriff kann dein Kunde deine Ankunft nicht sehen. Du kannst ihn in den Einstellungen erlauben.',
    location_unavailable: 'Dein Standort ist gerade nicht verfügbar. Geh kurz ins Freie und versuch es erneut.',
    no_destination: 'Diese Adresse konnte nicht auf der Karte gefunden werden. Nutze die Route in deiner Karten-App.',
    not_allowed: 'Live-Ankunft ist nur am Tag eines bestätigten Termins möglich.',
    network: 'Keine Verbindung. Prüfe dein Netz und versuch es erneut.',
  },
  en: {
    permission_denied: 'Without location access your customer cannot see your arrival. You can allow it in Settings.',
    location_unavailable: 'Your location is not available right now. Step outside for a moment and try again.',
    no_destination: 'We could not find this address on the map. Use directions in your maps app instead.',
    not_allowed: 'Live arrival works on the day of an accepted appointment only.',
    network: 'No connection. Check your signal and try again.',
  },
};

function PromiseLine({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.promiseLine}>
      <Feather name={icon} size={15} color={colors.accentText} style={styles.promiseIcon} />
      <Text style={[styles.promiseText, { color: colors.textPrimary, fontFamily: fonts.body }]}>{text}</Text>
    </View>
  );
}

function SecondaryAction({ icon, label, onPress, testID }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; testID: string }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.secondary, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <Feather name={icon} size={16} color={colors.textPrimary} />
      <Text style={[styles.secondaryText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
    </Pressable>
  );
}

export function TripIntro({ firstName, address, startError, starting, de, onStart }: {
  firstName: string;
  address: string;
  startError: StartTripError | null;
  starting: boolean;
  de: boolean;
  onStart: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <>
      <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {de ? `Auf dem Weg zu ${firstName}?` : `On your way to ${firstName}?`}
      </Text>
      <Text style={[styles.address, { color: colors.textSecondary, fontFamily: fonts.body }]} numberOfLines={2} selectable>{address}</Text>
      <View style={[styles.promise, { borderColor: colors.border }]}>
        <PromiseLine icon="navigation" text={de ? `${firstName} sieht deine Ankunftszeit live und wird kurz vorher benachrichtigt.` : `${firstName} sees your live arrival time and gets a heads-up just before you arrive.`} />
        <PromiseLine icon="eye-off" text={de ? 'Nur während der Anfahrt. Bei Ankunft oder Stopp wird dein Standort gelöscht.' : 'Only while you travel. Your location is deleted when you arrive or stop.'} />
        <PromiseLine icon="battery" text={de ? 'Sparsam: Updates nur bei Bewegung.' : 'Battery-friendly: updates only as you move.'} />
      </View>
      {startError ? (
        <View style={styles.errorBox} accessibilityRole="alert" testID="barber-trip-error">
          <Text style={[styles.errorText, { color: colors.errorText, fontFamily: fonts.body }]}>{ERROR_COPY[de ? 'de' : 'en'][startError]}</Text>
          {startError === 'permission_denied' ? (
            <Text onPress={() => void Linking.openSettings()} accessibilityRole="link" style={[styles.link, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
              {de ? 'Einstellungen öffnen' : 'Open Settings'}
            </Text>
          ) : null}
        </View>
      ) : null}
      <PrimaryButton
        label={starting ? (de ? 'Beste Route wird gesucht …' : 'Finding the best route…') : (de ? 'Ich bin unterwegs' : "I'm on my way")}
        icon="navigation"
        onPress={onStart}
        loading={starting}
        testID="barber-trip-start"
      />
    </>
  );
}

export function TripLive({ live, phase, firstName, de, onNavigate, onArrived, onStop, onDone }: {
  live: LiveTripState;
  phase: TripPhase;
  firstName: string;
  de: boolean;
  onNavigate: () => void;
  onArrived: () => void;
  onStop: () => void;
  onDone: () => void;
}) {
  const { colors, fonts } = useTheme();
  const noteStyle = [styles.note, { color: colors.textSecondary, fontFamily: fonts.body }];
  return (
    <>
      <TripStatusPanel
        phase={phase}
        etaS={live.snapshot?.etaS ?? null}
        remainingM={live.snapshot?.remainingM ?? null}
        progress={live.snapshot?.progress ?? null}
        caption={live.arrived
          ? (de ? `${firstName} wurde benachrichtigt.` : `${firstName} has been notified.`)
          : (de ? `${firstName} sieht deine Ankunft live` : `${firstName} is following your arrival`)}
        testID="barber-trip-status"
      />
      {live.route.source === 'estimate' && !live.arrived ? (
        <Text style={noteStyle}>{de ? 'Routendienst nicht erreichbar — Ankunft wird geschätzt.' : 'Route service unreachable — arrival is estimated.'}</Text>
      ) : null}
      {live.mode === 'foreground' && !live.arrived ? (
        <Text style={noteStyle}>{de ? 'Lass Privelier geöffnet, damit die Ankunft aktuell bleibt.' : 'Keep Privelier open so your arrival stays up to date.'}</Text>
      ) : null}

      <View style={styles.actions}>
        {!live.arrived ? (
          <>
            <PrimaryButton label={de ? 'Navigation starten' : 'Start navigation'} icon="map" onPress={onNavigate} testID="barber-trip-navigate" />
            <View style={styles.actionRow}>
              <SecondaryAction icon="check" label={de ? 'Ich bin da' : "I've arrived"} onPress={onArrived} testID="barber-trip-arrived" />
              <SecondaryAction icon="pause-circle" label={de ? 'Teilen stoppen' : 'Stop sharing'} onPress={onStop} testID="barber-trip-stop" />
            </View>
          </>
        ) : (
          <PrimaryButton label={de ? 'Fertig' : 'Done'} onPress={onDone} testID="barber-trip-done" />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, lineHeight: 32 },
  address: { fontSize: 15, lineHeight: 22 },
  promise: { borderTopWidth: HAIRLINE, borderBottomWidth: HAIRLINE, paddingVertical: space.md, gap: space.md },
  promiseLine: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  promiseIcon: { marginTop: 3 },
  promiseText: { flex: 1, fontSize: 14, lineHeight: 20 },
  errorBox: { gap: space.xs },
  errorText: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, paddingVertical: space.xs },
  note: { fontSize: 13, lineHeight: 19 },
  actions: { gap: space.sm, marginTop: space.xs },
  actionRow: { flexDirection: 'row', gap: space.sm },
  secondary: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
  },
  secondaryText: { fontSize: 14 },
});
