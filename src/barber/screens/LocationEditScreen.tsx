/**
 * Barber "your location" screen (Explore/location Run A — design:
 * docs/design/explore-location-design-approval.md) — a leaf STACK screen
 * reached from the Studio tab's Location card, following BioEditScreen's
 * shape exactly (leaf editor, plain useEffect mount-fetch per the bio-edit C6
 * precedent, save pops back to Studio whose focus refresh re-reads the card).
 *
 * Flow: the barber types their address → debounced Mapbox forward geocoding
 * (src/shared/geocoding.ts, plain HTTPS — no native module) → picks a
 * candidate → saves. The saved coordinates are ALWAYS a picked candidate's,
 * never hand-typed (free text without a picked candidate cannot be saved
 * with coordinates), so every pin on the Explore map traces back to a real
 * geocode. Clearing the field and saving removes the location entirely — the
 * 0019 trigger then NULLs the display coords and the barber's pin disappears
 * (founder decision D4: never a stale or fake pin).
 *
 * Privacy (founder decision D2, consent copy is mandatory on this screen):
 * customers only ever see an approximate area — the stored display
 * coordinates are offset 200–500 m server-side; the exact address and
 * coordinates never leave the barber's own row.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import { forwardGeocode, type GeocodeCandidate } from '../../shared/geocoding';
import { MAX_ADDRESS_LENGTH, fetchOwnLocation, updateOwnLocation } from '../locationData';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'LocationEdit'>;

/** Debounce for the geocode-as-you-type search. */
const SEARCH_DEBOUNCE_MS = 450;
/** Minimum characters before we bother the geocoder. */
const MIN_QUERY_LENGTH = 4;

export default function LocationEditScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [text, setText] = useState('');
  /** The candidate whose coordinates a save would store. Editing the text
   * away from its label invalidates it — coordinates are never stale. */
  const [selected, setSelected] = useState<GeocodeCandidate | null>(null);
  /** What is currently saved server-side (address + whether coords exist). */
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [savedHasCoords, setSavedHasCoords] = useState(false);

  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

  // Mount fetch (plain useEffect — leaf editor, bio-edit C6 precedent).
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id ?? null;
      if (!active) return;
      setBarberId(id);
      if (!id) {
        setLoading(false);
        setLoadError('We could not find your account. Try signing out and back in.');
        return;
      }
      const result = await fetchOwnLocation(id);
      if (!active) return;
      setLoading(false);
      if (result.status === 'ok') {
        const row = result.location;
        const address = row?.address ?? '';
        setText(address);
        setSavedAddress(row?.address ?? null);
        const hasCoords = row?.latitude != null && row?.longitude != null;
        setSavedHasCoords(hasCoords);
        if (row && hasCoords && row.address) {
          // Seed the selection from the saved row so an untouched screen is
          // simply "not dirty" rather than "must re-pick".
          setSelected({ label: row.address, latitude: row.latitude!, longitude: row.longitude! });
        }
      } else {
        setLoadError(result.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Debounced geocode-as-you-type, driven entirely from the change handler
  // (no setState-in-effect): each keystroke cancels the pending timer, and a
  // sequence counter drops any response a newer keystroke superseded. Skips:
  // short input and input that equals the current selection's label.
  const searchSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSearch = useCallback(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    searchSeq.current += 1;
  }, []);

  // Unmount: no timer survives, no late response can set state.
  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const onChangeText = useCallback(
    (next: string) => {
      setText(next);
      setSearchError(null);
      setSearched(false);
      const query = next.trim();
      const stillSelected = selected !== null && query === selected.label;
      if (!stillSelected && selected !== null) setSelected(null);

      cancelPendingSearch();
      if (query.length < MIN_QUERY_LENGTH || stillSelected) {
        setCandidates([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const seq = searchSeq.current;
      searchTimer.current = setTimeout(async () => {
        const result = await forwardGeocode(query);
        if (seq !== searchSeq.current) return; // superseded or unmounted
        setSearching(false);
        setSearched(true);
        if (result.status === 'ok') {
          setCandidates(result.candidates);
        } else {
          setCandidates([]);
          setSearchError(result.message);
        }
      }, SEARCH_DEBOUNCE_MS);
    },
    [selected, cancelPendingSearch]
  );

  const pickCandidate = useCallback(
    (candidate: GeocodeCandidate) => {
      cancelPendingSearch();
      setSelected(candidate);
      setText(candidate.label);
      setCandidates([]);
      setSearching(false);
      setSearched(false);
    },
    [cancelPendingSearch]
  );

  const trimmed = text.trim();
  const clearing = trimmed === '';
  const selectionCurrent = selected !== null && trimmed === selected.label;

  // Save rules: a clear is dirty when something is saved; a picked candidate
  // is dirty when it differs from what is saved. Free text with no picked
  // candidate is never saveable — coordinates only ever come from a geocode.
  const dirty = clearing
    ? savedAddress !== null || savedHasCoords
    : selectionCurrent && (selected.label !== savedAddress || !savedHasCoords);
  const canSave = !loading && !submitting && barberId !== null && dirty;
  const needsPick = !clearing && !selectionCurrent;

  const onSave = useCallback(async () => {
    if (!barberId) return;
    setSubmitting(true);
    setFormError(null);
    const result = clearing
      ? await updateOwnLocation(barberId, { address: '', latitude: null, longitude: null })
      : await updateOwnLocation(barberId, {
          address: selected!.label,
          latitude: selected!.latitude,
          longitude: selected!.longitude,
        });
    setSubmitting(false);
    if (result.status === 'ok') {
      navigation.goBack();
    } else {
      setFormError(result.message);
    }
  }, [barberId, clearing, selected, navigation]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="barber-location-screen"
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          testID="barber-location-back"
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={16} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Your location
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="barber-location-loading"
        />
      ) : loadError ? (
        <View
          testID="barber-location-load-error"
          accessibilityRole="alert"
          style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
            {loadError}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Your base address places you on the Explore map so nearby customers can find you.
            </Text>

            {/* Consent copy — mandatory per founder decision D2. */}
            <View
              testID="barber-location-consent"
              style={[styles.consent, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Feather name="eye-off" size={14} color={colors.textSecondary} style={styles.consentIcon} />
              <Text style={[styles.consentText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Customers only ever see an approximate area — never your exact address. Your pin is
                shifted a few hundred metres, and your street address stays private.
              </Text>
            </View>

            {formError ? (
              <View
                testID="barber-location-error"
                accessibilityRole="alert"
                style={[styles.notice, styles.noticeInline, { borderColor: colors.error, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <TextInput
              value={text}
              onChangeText={onChangeText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="e.g. Prinsengracht 263, Amsterdam"
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_ADDRESS_LENGTH}
              autoCorrect={false}
              accessibilityLabel="Your address"
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: focused ? colors.accent : colors.border,
                  fontFamily: fonts.body,
                },
              ]}
              testID="barber-location-input"
            />

            {searching ? (
              <View style={styles.searchStatusRow} testID="barber-location-searching">
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.searchStatusText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  Looking up addresses…
                </Text>
              </View>
            ) : null}

            {searchError ? (
              <Text
                testID="barber-location-search-error"
                style={[styles.searchStatusText, { color: colors.errorText, fontFamily: fonts.body }]}
              >
                {searchError}
              </Text>
            ) : null}

            {!searching && searched && candidates.length === 0 && !searchError ? (
              <Text
                testID="barber-location-no-results"
                style={[styles.searchStatusText, { color: colors.textSecondary, fontFamily: fonts.body }]}
              >
                No matches for that address. Try adding a street number or city.
              </Text>
            ) : null}

            {candidates.length > 0 ? (
              <View
                style={[styles.candidates, { borderColor: colors.border, backgroundColor: colors.surface }]}
                testID="barber-location-candidates"
              >
                {candidates.map((candidate, index) => (
                  <Pressable
                    key={`${candidate.latitude},${candidate.longitude},${index}`}
                    onPress={() => pickCandidate(candidate)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use address ${candidate.label}`}
                    testID={`barber-location-candidate-${index}`}
                    style={({ pressed }) => [
                      styles.candidateRow,
                      index < candidates.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Feather name="map-pin" size={14} color={colors.textSecondary} />
                    <Text
                      numberOfLines={2}
                      style={[styles.candidateText, { color: colors.textPrimary, fontFamily: fonts.body }]}
                    >
                      {candidate.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {needsPick && !searching && trimmed.length >= MIN_QUERY_LENGTH ? (
              <Text
                testID="barber-location-pick-hint"
                style={[styles.searchStatusText, { color: colors.textSecondary, fontFamily: fonts.body }]}
              >
                Pick a suggestion so we can place you on the map.
              </Text>
            ) : null}

            <Pressable
              onPress={onSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={clearing ? 'Remove your location' : 'Save location'}
              accessibilityState={{ disabled: !canSave }}
              testID="barber-location-save"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.accent, opacity: !canSave ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <>
                  <Feather name={clearing ? 'trash-2' : 'check'} size={14} color={colors.onAccent} />
                  <Text style={[styles.primaryButtonText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
                    {clearing ? 'Remove location' : 'Save location'}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 24, marginTop: 16 },
  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 10, padding: 12, marginHorizontal: 24, marginTop: 20 },
  noticeInline: { marginHorizontal: 0, marginTop: 0, marginBottom: 18 },
  noticeText: { fontSize: 14 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  consent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  consentIcon: { marginTop: 2 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 18 },
  input: { borderWidth: 0.5, borderRadius: 12, padding: 14, fontSize: 16 },
  searchStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  searchStatusText: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  candidates: { borderWidth: 0.5, borderRadius: 12, marginTop: 10 },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  candidateText: { flex: 1, fontSize: 14, lineHeight: 19 },
  primaryButton: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 24,
  },
  primaryButtonText: { fontSize: 15 },
});
