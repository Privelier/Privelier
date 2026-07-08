/**
 * Barber Portfolio tab — rebuild of the prototype's barber.portfolio
 * route: serif header, "N of 6 — a curated set." counter, and a 2-column
 * square grid with an add tile (brass plus) while under the cap.
 *
 * Real data via listOwnPortfolio (the PORTFOLIO table exists with its
 * DB-enforced max-6 constraint, so the grid and counter are live). Honesty
 * deviations from the prototype:
 * - the add tile explains that uploads open with a later update — actual
 *   upload/delete is build-order step 17 (private storage + image picker,
 *   the latter a native module needing a new dev-client build);
 * - accordingly there are no per-image delete buttons yet either.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import type { PortfolioRow } from '../../types';
import { listOwnPortfolio, MAX_PORTFOLIO_IMAGES } from '../portfolioData';

export default function PortfolioScreen() {
  const { colors, fonts } = useTheme();

  const [images, setImages] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error' || !profileResult.profile) {
      setLoading(false);
      setError(
        profileResult.status === 'error'
          ? profileResult.message
          : 'Could not load your profile.'
      );
      return;
    }

    const result = await listOwnPortfolio(profileResult.profile.id);
    setLoading(false);
    if (result.status === 'ok') {
      setImages(result.images);
    } else {
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly) for the same
    // react-hooks/set-state-in-effect reason as the other data screens.
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const onAdd = useCallback(() => {
    Alert.alert('Uploads open soon', 'Adding portfolio images is coming in an upcoming update.');
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="barber-portfolio-screen"
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Portfolio
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {`${images.length} of ${MAX_PORTFOLIO_IMAGES} — a curated set.`}
        </Text>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="barber-portfolio-loading"
          />
        ) : error ? (
          <View
            testID="barber-portfolio-error"
            accessibilityRole="alert"
            style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
              {error}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {images.map((img) => (
                <View
                  key={img.id}
                  style={[styles.tile, { backgroundColor: colors.surface }]}
                  testID={`barber-portfolio-image-${img.id}`}
                >
                  <Image source={{ uri: img.image_url }} style={styles.tileImage} resizeMode="cover" />
                </View>
              ))}
              {images.length < MAX_PORTFOLIO_IMAGES ? (
                <Pressable
                  onPress={onAdd}
                  accessibilityRole="button"
                  accessibilityLabel="Add image"
                  testID="barber-portfolio-add"
                  style={[styles.tile, styles.addTile, { borderColor: colors.border }]}
                >
                  <Feather name="plus" size={20} color={colors.accentText} />
                  <Text style={[styles.addLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    Add image
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {images.length === 0 ? (
              <Text style={[styles.emptyHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                Your best work, shown on your public profile.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  heading: { fontSize: 24 },
  subtitle: { fontSize: 12, marginTop: 4 },

  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 8, padding: 12, marginTop: 24 },
  noticeText: { fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  tile: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '48.5%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tileImage: { width: '100%', height: '100%' },
  addTile: {
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addLabel: { fontSize: 12 },
  emptyHint: { fontSize: 12, marginTop: 16 },
});
