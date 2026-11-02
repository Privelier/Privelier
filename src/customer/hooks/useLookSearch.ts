/**
 * Look search (Looks S4, flag-gated): style, day and time window, an
 * optional own reference photo, then instant matches from match_look. The
 * photo is uploaded (EXIF dropped) only when the client adds it, into their
 * private folder; it reaches a barber only once a booking references it, or
 * while a wish with it is open (S5: when nobody is free, the same choice
 * goes out as a wish to the city's proven barbers).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { fetchBookableService, fetchLookStyles, matchLook, removeReferencePhoto, uploadReferencePhoto } from '../../looks/looksData';
import { SEARCH_WINDOWS, searchDays, type SearchWindow } from '../../looks/searchPresentation';
import type { LookMatch, LookStyle } from '../../looks/types';
import { createWish } from '../../looks/wishData';

const DAYS = 7;

export function useLookSearch(initialStyle: string | undefined) {
  const [days] = useState(() => searchDays(DAYS));
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [style, setStyle] = useState<string | null>(initialStyle ?? null);
  const [day, setDay] = useState<string>(days[0]);
  const [slotWindow, setSlotWindow] = useState<SearchWindow>(SEARCH_WINDOWS[3]);
  const [photo, setPhoto] = useState<{ uri: string; path: string } | null>(null);
  const [matches, setMatches] = useState<LookMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchLookStyles().then((result) => {
      if (active && result.status === 'ok') setStyles(result.value);
    });
    return () => {
      active = false;
    };
  }, []);

  const guard = useCallback(async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const addPhoto = useCallback(() => guard(async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled) return;
    const uploaded = await uploadReferencePhoto(picked.assets[0].uri);
    if (uploaded.status !== 'ok') return setError(uploaded.message);
    setPhoto({ uri: picked.assets[0].uri, path: uploaded.value });
  }), [guard]);

  const search = useCallback(() => guard(async () => {
    if (!style) return;
    const result = await matchLook({ style, date: day, from: slotWindow.from, to: slotWindow.to });
    if (result.status !== 'ok') {
      setMatches(null);
      return setError(result.message);
    }
    setMatches(result.value);
  }), [guard, style, day, slotWindow]);

  /** The fallback when nobody is free: true once the wish went out. */
  const sendWish = useCallback(async () => {
    let sent = false;
    await guard(async () => {
      if (!style) return;
      const result = await createWish({ style, day, from: slotWindow.from, to: slotWindow.to, photoPath: photo?.path ?? null });
      if (result.status !== 'ok') return setError(result.message);
      sent = true;
    });
    return sent;
  }, [guard, style, day, slotWindow, photo]);

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setMatches(null);
  };

  return {
    days,
    styles,
    style,
    setStyle: reset(setStyle),
    day,
    setDay: reset(setDay),
    window: slotWindow,
    setWindow: reset(setSlotWindow),
    photo,
    removePhoto: () => {
      if (photo) void removeReferencePhoto(photo.path);
      setPhoto(null);
    },
    addPhoto,
    /** The real service row for booking a match (null if it was removed). */
    serviceFor: (match: LookMatch) => fetchBookableService(match.service_id),
    matches,
    busy,
    error,
    search,
    sendWish,
  };
}
