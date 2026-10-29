/**
 * The client's private look pass (Looks S6, flag-gated): their own looks,
 * newest first, each with the reference they booked with and the result,
 * as short-lived signed links (result and feed-look photos from `looks`,
 * their own reference photo from `look-references`).
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchBookableService, fetchLookStyles, fetchMyLooks, signLookPhotos, signReferencePhoto } from '../../looks/looksData';
import type { LookStyle, PassLook } from '../../looks/types';

export interface PassImages {
  reference: string | null;
  result: string | null;
}

export function useLookPass() {
  const [looks, setLooks] = useState<PassLook[] | null>(null);
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [images, setImages] = useState<Record<string, PassImages>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [mine, styleList] = await Promise.all([fetchMyLooks(), fetchLookStyles()]);
    if (styleList.status === 'ok') setStyles(styleList.value);
    if (mine.status !== 'ok') {
      setError(mine.message);
      setLooks((current) => current ?? []);
      return;
    }
    setError(null);
    setLooks(mine.value);
    const lookPaths = mine.value.flatMap((look) => [look.photo_paths[0], look.reference_look_photo].filter((path): path is string => Boolean(path)));
    const [signed, references] = await Promise.all([
      signLookPhotos(lookPaths),
      Promise.all(mine.value.map((look) => (look.reference_photo_path ? signReferencePhoto(look.reference_photo_path) : Promise.resolve(null)))),
    ]);
    setImages(Object.fromEntries(mine.value.map((look, index) => [look.look_id, {
      reference: references[index] ?? (look.reference_look_photo ? signed.get(look.reference_look_photo) ?? null : null),
      result: look.photo_paths[0] ? signed.get(look.photo_paths[0]) ?? null : null,
    }])));
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return {
    looks,
    styles,
    error,
    imagesFor: (look: PassLook): PassImages => images[look.look_id] ?? { reference: null, result: null },
    /** The real service row to book the same look again (null if it was removed). */
    serviceFor: (look: PassLook) => (look.service_id ? fetchBookableService(look.service_id) : Promise.resolve(null)),
  };
}
