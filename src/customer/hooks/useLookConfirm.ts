/**
 * The client's side of a proof look (Looks S2): load the look the barber
 * sent for one booking, show its photos through short-lived signed URLs,
 * and record the two answers ("Is this your cut?", "May it be shown?"), or
 * stop showing / withdraw it later. Every rule is re-checked server-side.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { reportUser } from '../../shared/moderationData';
import { answerLook, fetchLookForBooking, fetchLookStyles, signLookPhotos, takeBackLook } from '../../looks/looksData';
import { lookStage } from '../../looks/lookPresentation';
import type { Look, LookStyle } from '../../looks/types';

export function useLookConfirm(bookingId: string) {
  const [look, setLook] = useState<Look | null>(null);
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [lookResult, styleResult] = await Promise.all([fetchLookForBooking(bookingId), fetchLookStyles()]);
    if (lookResult.status !== 'ok') {
      setLoading(false);
      return setError(lookResult.message);
    }
    if (styleResult.status === 'ok') setStyles(styleResult.value);
    const found = lookResult.value;
    setLook(found);
    if (found) setUrls(await signLookPhotos(found.look_photos.map((photo) => photo.storage_path)));
    setLoading(false);
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

  const run = useCallback(async (work: (current: Look) => Promise<void>) => {
    if (busyRef.current || !look) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await work(look);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [look]);

  const apply = (result: Awaited<ReturnType<typeof answerLook>>) => {
    if (result.status !== 'ok') return setError(result.message);
    setLook(result.value);
    if (result.value.status !== 'published') setUrls(new Map());
  };

  return {
    look,
    styles,
    urls,
    stage: lookStage(look),
    loading,
    error,
    busy,
    reported,
    load,
    answer: (isMine: boolean, show: boolean) => run(async (current) => apply(await answerLook(current, { isMine, show }))),
    takeBack: (mode: 'hide' | 'withdraw') => run(async (current) => apply(await takeBackLook(current, mode))),
    report: () => run(async (current) => {
      const result = await reportUser({ target: { type: 'look', lookId: current.id }, reason: 'inappropriate_content' });
      if (result.status !== 'ok') return setError(result.message);
      setReported(true);
    }),
  };
}
