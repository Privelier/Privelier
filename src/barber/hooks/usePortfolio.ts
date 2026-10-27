/**
 * The barber's portfolio with upload and delete.
 *
 * Upload: the system photo picker (no library permission), then the strict
 * two-step flow uploadPortfolioImage (bytes → PUBLIC bucket) then
 * insertPortfolioRow (path → own portfolio row). A failed upload never
 * reaches the row insert; a successful insert is reflected in the grid. A
 * synchronous busyRef guards against double-submit (React state commits too
 * late to block a fast second tap).
 *
 * Delete: DB-row-first (design D5); the grid removes the image
 * optimistically and re-adds it only if the delete fails. The max-6 gate is
 * client-side, with 'limit_reached' kept as the server-truth fallback.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation, Platform, UIManager } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fetchOwnProfile } from '../../auth/authService';
import { useToast } from '../../shared/components/ToastProvider';
import type { PortfolioRow } from '../../types';
import { deletePortfolioImage, insertPortfolioRow, listOwnPortfolio, MAX_PORTFOLIO_IMAGES, uploadPortfolioImage } from '../portfolioData';

// LayoutAnimation is opt-in on Android; enable it once at module load so the
// (reduce-motion-gated) delete-removal fade animates there too. No-op on iOS.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function usePortfolio(de: boolean) {
  const { showToast } = useToast();
  const [barberId, setBarberId] = useState<string | null>(null);
  const [images, setImages] = useState<PortfolioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // The picked image, held only while its upload is in flight so the
  // uploading tile can show it dimmed (no fake progress bar).
  const [pendingUri, setPendingUri] = useState<string | null>(null);
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
          : de ? 'Dein Profil konnte nicht geladen werden.' : 'Could not load your profile.'
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
  }, [de]);

  useEffect(() => {
    let active = true;
    // Deferred via .then() for the react-hooks/set-state-in-effect rule.
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const add = useCallback(async () => {
    if (busyRef.current) return;
    if (!barberId) {
      showToast({ message: de ? 'Dein Profil wird noch geladen. Versuch es gleich noch einmal.' : 'Your profile is still loading. Try again shortly.' });
      return;
    }
    if (images.length >= MAX_PORTFOLIO_IMAGES) return;

    busyRef.current = true;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (picked.canceled) return;
      const asset = picked.assets[0];

      setPendingUri(asset.uri);
      setUploading(true);
      const failed = de ? 'Upload fehlgeschlagen.' : 'Upload failed.';
      const uploaded = await uploadPortfolioImage(barberId, asset.uri);
      if (uploaded.status !== 'ok') {
        showToast({ message: `${failed} ${uploaded.message}` });
        return;
      }
      const inserted = await insertPortfolioRow(barberId, uploaded.path);
      if (inserted.status !== 'ok') {
        // Includes 'limit_reached' (the DB trigger's cap), surfaced verbatim.
        showToast({ message: `${failed} ${inserted.message}` });
        return;
      }
      setImages((prev) => [...prev, inserted.image]);
    } finally {
      busyRef.current = false;
      setUploading(false);
      setPendingUri(null);
    }
  }, [barberId, images.length, de, showToast]);

  const remove = useCallback(async (image: PortfolioRow) => {
    // Animate the tile's departure unless the user prefers reduced motion.
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setImages((prev) => prev.filter((i) => i.id !== image.id));
    const result = await deletePortfolioImage(image);
    if (result.status !== 'ok') {
      // A failed delete snaps back into its stable (by id) position.
      setImages((prev) => [...prev, image].sort((a, b) => a.id.localeCompare(b.id)));
      showToast({ message: `${de ? 'Löschen fehlgeschlagen.' : 'Could not delete.'} ${result.message}` });
    }
  }, [de, showToast]);

  return { images, loading, error, uploading, pendingUri, load, add, remove };
}
