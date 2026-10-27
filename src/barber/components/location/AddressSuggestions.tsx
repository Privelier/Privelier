/**
 * Address search feedback under the location input: searching, error, no
 * results, the candidate list and the "pick a suggestion" hint.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { GeocodeCandidate } from '../../../shared/geocoding';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

export function AddressSuggestions({ searching, searched, searchError, candidates, showPickHint, de, onPick }: {
  searching: boolean;
  searched: boolean;
  searchError: string | null;
  candidates: GeocodeCandidate[];
  showPickHint: boolean;
  de: boolean;
  onPick: (candidate: GeocodeCandidate) => void;
}) {
  const { colors, fonts } = useTheme();
  const muted = [styles.statusText, { color: colors.textSecondary, fontFamily: fonts.body }];
  return (
    <>
      {searching ? (
        <View style={styles.statusRow} testID="barber-location-searching">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={muted}>{de ? 'Adressen werden gesucht …' : 'Looking up addresses…'}</Text>
        </View>
      ) : null}

      {searchError ? (
        <Text testID="barber-location-search-error" style={[styles.statusText, { color: colors.errorText, fontFamily: fonts.body }]}>{searchError}</Text>
      ) : null}

      {!searching && searched && candidates.length === 0 && !searchError ? (
        <Text testID="barber-location-no-results" style={muted}>
          {de ? 'Keine Treffer für diese Adresse. Ergänze Hausnummer oder Stadt.' : 'No matches for that address. Try adding a street number or city.'}
        </Text>
      ) : null}

      {candidates.length > 0 ? (
        <View style={[styles.candidates, { borderColor: colors.border, backgroundColor: colors.surface }]} testID="barber-location-candidates">
          {candidates.map((candidate, index) => (
            <Pressable
              key={`${candidate.latitude},${candidate.longitude},${index}`}
              onPress={() => onPick(candidate)}
              accessibilityRole="button"
              accessibilityLabel={de ? `Adresse ${candidate.label} verwenden` : `Use address ${candidate.label}`}
              testID={`barber-location-candidate-${index}`}
              style={({ pressed }) => [
                styles.candidateRow,
                index < candidates.length - 1 && { borderBottomWidth: HAIRLINE, borderBottomColor: colors.border },
                { opacity: pressed ? pressOpacity.soft : 1 },
              ]}
            >
              <Feather name="map-pin" size={14} color={colors.textSecondary} />
              <Text numberOfLines={2} style={[styles.candidateText, { color: colors.textPrimary, fontFamily: fonts.body }]}>{candidate.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showPickHint ? (
        <Text testID="barber-location-pick-hint" style={muted}>
          {de ? 'Wähle einen Vorschlag, damit wir dich auf der Karte platzieren können.' : 'Pick a suggestion so we can place you on the map.'}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 10 },
  statusText: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  candidates: { borderWidth: HAIRLINE, borderRadius: radius.lg, marginTop: 10 },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: space.md,
    minHeight: 44,
  },
  candidateText: { flex: 1, fontSize: 14, lineHeight: 19 },
});
