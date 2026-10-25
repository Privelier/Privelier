/**
 * In-home safety for the barber-travels-to-you model (AGENTS.md "deferred
 * but tracked" item; founder decision by Ali, 2026-10-25, to build it with
 * live tracking).
 *
 *  - SOS: dials the local emergency number from the phone itself (works with
 *    no data connection) and records a safety_events row for the founders —
 *    never forwarded to the other participant.
 *  - Share trip: hands the appointment details and a free OpenStreetMap link
 *    of the current position to any contact via the system share sheet.
 *
 * Position is attached only when location permission was already granted;
 * these actions never trigger a permission prompt in a stressful moment.
 */
import { Linking, Share } from 'react-native';
import * as Localization from 'expo-localization';
import * as Location from 'expo-location';
import { supabase } from '../../../lib/supabase';
import { getAppLanguage } from '../locale';
import type { LngLat } from './geo';

const EMERGENCY_BY_REGION: Record<string, string> = {
  US: '911',
  CA: '911',
  MX: '911',
  GB: '999',
  AU: '000',
  NZ: '111',
  IN: '112',
};

/** 112 works across the EU and on most GSM phones worldwide. */
export function emergencyNumber(region = Localization.getLocales()[0]?.regionCode ?? null): string {
  return (region && EMERGENCY_BY_REGION[region.toUpperCase()]) || '112';
}

export function osmLink([lng, lat]: LngLat): string {
  const la = lat.toFixed(5);
  const lo = lng.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=17/${la}/${lo}`;
}

/** Last known position if permission is already granted — never prompts. */
export async function currentPositionIfPermitted(): Promise<LngLat | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const fix =
      (await Location.getLastKnownPositionAsync({ maxAge: 120_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return fix ? [fix.coords.longitude, fix.coords.latitude] : null;
  } catch {
    return null;
  }
}

async function logSafetyEvent(bookingId: string, kind: 'sos' | 'trip_shared', position: LngLat | null) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const { error } = await supabase.from('safety_events').insert({
    booking_id: bookingId,
    user_id: userId,
    kind,
    latitude: position?.[1] ?? null,
    longitude: position?.[0] ?? null,
  });
  if (error && __DEV__) console.warn('[safety] log failed', error);
}

/**
 * Calls emergency services first (nothing may delay the call), then logs.
 * Returns false if the device cannot place calls (tablet, simulator).
 */
export async function triggerSos(bookingId: string): Promise<boolean> {
  const url = `tel:${emergencyNumber()}`;
  let called = false;
  try {
    await Linking.openURL(url);
    called = true;
  } catch {
    called = false;
  }
  void currentPositionIfPermitted().then((position) => logSafetyEvent(bookingId, 'sos', position));
  return called;
}

export async function shareTrip(input: {
  bookingId: string;
  role: 'customer' | 'barber';
  counterpartName: string;
  address: string;
  whenText: string;
  etaText?: string | null;
}): Promise<void> {
  const de = getAppLanguage() === 'de';
  const position = await currentPositionIfPermitted();
  const lines = de
    ? [
        input.role === 'barber'
          ? `Ich bin bei einem Privelier-Termin bei ${input.counterpartName}.`
          : `Ich habe einen Privelier-Termin mit ${input.counterpartName}.`,
        `Adresse: ${input.address}`,
        `Zeit: ${input.whenText}`,
        input.etaText ? `Voraussichtliche Ankunft: ${input.etaText}` : null,
        position ? `Mein aktueller Standort: ${osmLink(position)}` : null,
      ]
    : [
        input.role === 'barber'
          ? `I'm at a Privelier appointment with ${input.counterpartName}.`
          : `I have a Privelier appointment with ${input.counterpartName}.`,
        `Address: ${input.address}`,
        `Time: ${input.whenText}`,
        input.etaText ? `Expected arrival: ${input.etaText}` : null,
        position ? `My current location: ${osmLink(position)}` : null,
      ];
  const result = await Share.share({ message: lines.filter(Boolean).join('\n') });
  if (result.action === Share.sharedAction) void logSafetyEvent(input.bookingId, 'trip_shared', position);
}
