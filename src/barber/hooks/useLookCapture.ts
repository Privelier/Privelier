/**
 * Capture the result of a completed booking (Looks S2, migration 0063).
 *
 * The draft is created on the first photo with the styles picked so far and
 * updated again on send, so styles and the no-face confirmation can change
 * until the look goes to the client. Photos upload one at a time: system
 * picker (no permission), re-encode (EXIF/GPS dropped), private bucket, then
 * attach. A failed upload never reaches attach. A busy ref blocks a fast
 * second tap before React state commits.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useToast } from '../../shared/components/ToastProvider';
import { attachLookPhoto, fetchLookForBooking, fetchLookStyles, removeLookPhoto, saveLookDraft, sendLook, signLookPhotos, takeBackLook, uploadLookPhoto } from '../../looks/looksData';
import { canSendLook, lookStage, MAX_LOOK_PHOTOS, toggleStyle } from '../../looks/lookPresentation';
import type { Look, LookPhoto, LookStyle } from '../../looks/types';

export interface CapturePhoto {
  photo: LookPhoto;
  uri: string | null;
}

export function useLookCapture({ bookingId, barberId, de }: { bookingId: string; barberId: string | null; de: boolean }) {
  const { showToast } = useToast();
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [noFace, setNoFace] = useState(false);
  const [look, setLook] = useState<Look | null>(null);
  const [photos, setPhotos] = useState<CapturePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [styleResult, lookResult] = await Promise.all([fetchLookStyles(), fetchLookForBooking(bookingId)]);
    setLoading(false);
    if (styleResult.status !== 'ok') return setError(styleResult.message);
    if (lookResult.status !== 'ok') return setError(lookResult.message);
    setStyles(styleResult.value);
    const existing = lookResult.value;
    setLook(existing);
    if (!existing) return;
    setSelected(existing.styles);
    setNoFace(existing.no_face_confirmed);
    const urls = await signLookPhotos(existing.look_photos.map((p) => p.storage_path));
    setPhotos(existing.look_photos.map((photo) => ({ photo, uri: urls.get(photo.storage_path) ?? null })));
  }, [bookingId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const guard = useCallback(async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const ensureDraft = useCallback(async (): Promise<Look | null> => {
    if (look) return look;
    const result = await saveLookDraft({ bookingId, styles: selected, noFace });
    if (result.status !== 'ok') {
      showToast({ message: result.message });
      return null;
    }
    setLook(result.value);
    return result.value;
  }, [look, bookingId, selected, noFace, showToast]);

  const addPhoto = useCallback(() => guard(async () => {
    if (!barberId || photos.length >= MAX_LOOK_PHOTOS) return;
    if (selected.length === 0) {
      showToast({ message: de ? 'Wähle zuerst mindestens einen Stil.' : 'Pick at least one style first.' });
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled) return;
    const draft = await ensureDraft();
    if (!draft) return;
    const uploaded = await uploadLookPhoto(barberId, picked.assets[0].uri);
    if (uploaded.status !== 'ok') return showToast({ message: uploaded.message });
    const attached = await attachLookPhoto(draft.id, uploaded.value);
    if (attached.status !== 'ok') return showToast({ message: attached.message });
    setPhotos((prev) => [...prev, { photo: attached.value, uri: picked.assets[0].uri }]);
  }), [guard, barberId, photos.length, selected.length, de, ensureDraft, showToast]);

  const removePhoto = useCallback((item: CapturePhoto) => guard(async () => {
    const result = await removeLookPhoto(item.photo);
    if (result.status !== 'ok') return showToast({ message: result.message });
    setPhotos((prev) => prev.filter((p) => p.photo.id !== item.photo.id));
  }), [guard, showToast]);

  const send = useCallback(() => guard(async () => {
    const saved = await saveLookDraft({ bookingId, styles: selected, noFace });
    if (saved.status !== 'ok') return setError(saved.message);
    const sent = await sendLook(saved.value.id);
    if (sent.status !== 'ok') return setError(sent.message);
    setError(null);
    await load();
  }), [guard, bookingId, selected, noFace, load]);

  const withdraw = useCallback(() => guard(async () => {
    if (!look) return;
    const result = await takeBackLook(look, 'withdraw');
    if (result.status !== 'ok') return setError(result.message);
    setLook(result.value);
  }), [guard, look]);

  const stage = lookStage(look);
  const editable = stage === 'none' || stage === 'editing';
  return {
    styles,
    selected,
    toggle: (key: string) => setSelected((prev) => toggleStyle(prev, key)),
    noFace,
    setNoFace,
    photos,
    stage,
    editable,
    canSend: editable && canSendLook({ styles: selected, photoCount: photos.length, noFace }),
    loading,
    error,
    busy,
    load,
    addPhoto,
    removePhoto,
    send,
    withdraw,
  };
}
