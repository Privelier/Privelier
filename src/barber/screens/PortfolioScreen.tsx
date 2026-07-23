/**
 * Barber Portfolio tab — rebuild of the prototype's barber.portfolio
 * route: serif header, "N of 6 — a curated set." counter, and a 2-column
 * square grid with an add tile (brass plus) while under the cap.
 *
 * Upload + delete are live (build-order step 17):
 * - the add tile mirrors VerifyScreen's expo-image-picker usage — request
 *   media-library permission, launchImageLibraryAsync, then the strict
 *   two-step data-layer flow uploadPortfolioImage (bytes → PUBLIC bucket) then
 *   insertPortfolioRow (path → own portfolio row). A failed upload never
 *   reaches the row insert; a successful insert is reflected optimistically in
 *   the grid. A synchronous busyRef guards against double-submit (the chat
 *   feature's lesson — React state commits too late to block a second tap);
 * - each image carries a delete affordance → a destructive confirm → the
 *   data layer's DB-row-first delete (design D5); the grid removes the image
 *   optimistically and reconciles (re-adds) only if the delete fails.
 *
 * Images render via getPublicPortfolioUrl(image_url) — the DB stores the
 * object PATH, never a URL (design D2). The client-side max-6 gate hides the
 * add tile at the cap; a 'limit_reached' failure is still handled as the
 * honest server-truth fallback (e.g. a concurrent session raced past the cap).
 *
 * expo-image-picker is already a project dependency (VerifyScreen uses it), so
 * this adds no new native module and needs no new dev-client build. The
 * fetch(uri).arrayBuffer() read inside the data layer only truly runs
 * on-device.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { fetchOwnProfile } from '../../auth/authService';
import { PortfolioGrid, portfolioTileStyle } from '../../shared/components/PortfolioGrid';
import { PortfolioTile } from '../../shared/components/PortfolioTile';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';
import { Notice } from '../../shared/components/Notice';
import type { PortfolioRow } from '../../types';
import {
  deletePortfolioImage,
  insertPortfolioRow,
  listOwnPortfolio,
  MAX_PORTFOLIO_IMAGES,
  uploadPortfolioImage,
} from '../portfolioData';

// LayoutAnimation is opt-in on Android; enable it once at module load so the
// (reduce-motion-gated) delete-removal fade animates there too. No-op on iOS.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PortfolioScreen() {
  const { colors, fonts } = useTheme();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [images, setImages] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // The actual picked image, held only while its upload is in flight so the
  // uploading tile can show it dimmed under a scrim (honest delight — no
  // fabricated content, no fake progress bar).
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  // Synchronous re-entry guard: React state (`uploading`) commits a tick too
  // late to reliably block a fast second tap, so the ref is the real gate.
  const busyRef = useRef(false);

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
    const id = profileResult.profile.id;
    setBarberId(id);

    const result = await listOwnPortfolio(id);
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

  const onAdd = useCallback(async () => {
    // Belt-and-suspenders: the add tile is disabled while uploading, but the
    // ref blocks a second tap that slips in before the disable commits.
    if (busyRef.current) return;
    if (!barberId) {
      Alert.alert('One moment', 'Your profile is still loading — try again shortly.');
      return;
    }
    if (images.length >= MAX_PORTFOLIO_IMAGES) return;

    busyRef.current = true;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to add portfolio images.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];

      setPendingUri(asset.uri);
      setUploading(true);
      // Strict order: bytes to the bucket first, then the row insert, then
      // reflect the new row. A failure at either step surfaces its honest
      // message and never fabricates an "added" tile.
      const uploaded = await uploadPortfolioImage(barberId, asset.uri, asset.mimeType);
      if (uploaded.status !== 'ok') {
        Alert.alert('Upload failed', uploaded.message);
        return;
      }
      const inserted = await insertPortfolioRow(barberId, uploaded.path);
      if (inserted.status !== 'ok') {
        // Includes 'limit_reached' (the DB trigger's server-truth cap) — its
        // copy is already brand-voiced, so surface it verbatim.
        Alert.alert('Upload failed', inserted.message);
        return;
      }
      setImages((prev) => [...prev, inserted.image]);
    } finally {
      busyRef.current = false;
      setUploading(false);
      setPendingUri(null);
    }
  }, [barberId, images.length]);

  const performDelete = useCallback(async (image: PortfolioRow) => {
    // Animate the tile's departure unless the user prefers reduced motion.
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    // Optimistic remove (design D5: the data layer deletes the DB row first,
    // so once this returns ok the image is gone from every read path).
    setImages((prev) => prev.filter((i) => i.id !== image.id));
    const result = await deletePortfolioImage(image);
    if (result.status !== 'ok') {
      // Reconcile: put it back in its original order (stable by id). No
      // animation on the re-add — a failed delete should snap back, not glide.
      setImages((prev) =>
        [...prev, image].sort((a, b) => a.id.localeCompare(b.id))
      );
      Alert.alert('Could not delete', result.message);
    }
  }, []);

  const onDelete = useCallback(
    (image: PortfolioRow) => {
      Alert.alert(
        'Delete image',
        'Remove this image from your portfolio?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void performDelete(image) },
        ]
      );
    },
    [performDelete]
  );

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
        <Text
          style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}
          testID="barber-portfolio-counter"
        >
          <Text style={{ color: colors.accentText, fontFamily: fonts.bodySemiBold }}>
            {images.length}
          </Text>
          {` of ${MAX_PORTFOLIO_IMAGES} — a curated set.`}
        </Text>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.spinner}
            testID="barber-portfolio-loading"
          />
        ) : error ? (
          <Notice testID="barber-portfolio-error" message={error} style={styles.noticeMargins} />
        ) : (
          <>
            <PortfolioGrid style={styles.gridSpacing}>
              {images.map((img) => (
                <PortfolioTile
                  key={img.id}
                  imagePath={img.image_url}
                  onDelete={() => onDelete(img)}
                  deleteDisabled={uploading}
                  testID={`barber-portfolio-image-${img.id}`}
                  deleteTestID={`barber-portfolio-delete-${img.id}`}
                />
              ))}

              {uploading ? (
                <View
                  style={[portfolioTileStyle, { backgroundColor: colors.surface }]}
                  testID="barber-portfolio-uploading"
                  accessibilityRole="progressbar"
                  accessibilityLabel="Uploading image"
                >
                  {pendingUri ? (
                    <Image source={{ uri: pendingUri }} style={styles.uploadingImage} resizeMode="cover" />
                  ) : null}
                  <View style={[styles.uploadingScrim, { backgroundColor: UPLOAD_SCRIM }]}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                </View>
              ) : images.length < MAX_PORTFOLIO_IMAGES ? (
                <Pressable
                  onPress={() => void onAdd()}
                  accessibilityRole="button"
                  accessibilityLabel="Add portfolio image"
                  testID="barber-portfolio-add"
                  style={({ pressed }) => [
                    portfolioTileStyle,
                    styles.addTile,
                    { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 },
                  ]}
                >
                  <Feather name="plus" size={20} color={colors.accentText} />
                  <Text style={[styles.addLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    Add image
                  </Text>
                </Pressable>
              ) : null}
            </PortfolioGrid>
            {images.length === 0 && !uploading ? (
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

// The uploading tile dims the real picked image under a flat scrim while its
// bytes upload — a fixed over-image value, theme-independent by design (same
// precedent as the shared delete scrim / the customer hero scrim).
const UPLOAD_SCRIM = 'rgba(18,18,20,0.45)';

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space['2xl'] },
  heading: { fontSize: 30 },
  subtitle: { fontSize: 12, marginTop: 4 },

  spinner: { marginTop: 48 },
  noticeMargins: { marginTop: space.xl },

  gridSpacing: { marginTop: space.xl },
  uploadingImage: { width: '100%', height: '100%' },
  uploadingScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    borderWidth: HAIRLINE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  addLabel: { fontSize: 12 },
  emptyHint: { fontSize: 12, marginTop: 16 },
});
