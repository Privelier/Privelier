/**
 * One published look with its proof chain (Looks S3): photos through signed
 * URLs, the barber's hit rate for the look's first style, and the service
 * "This look" books. A look that is gone (hidden, withdrawn, blocked, other
 * city) loads as null.
 */
import { useCallback, useEffect, useState } from 'react';
import { reportUser } from '../../shared/moderationData';
import { fetchBarberLookStats, fetchBookableService, fetchLookDetail, fetchLookStyles, signLookPhotos } from '../../looks/looksData';
import type { BarberLookStat, FeedLook, LookStyle } from '../../looks/types';
import type { ServiceRow } from '../../types';

export function useLookDetail(lookId: string) {
  const [look, setLook] = useState<FeedLook | null>(null);
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [stat, setStat] = useState<BarberLookStat | null>(null);
  const [service, setService] = useState<ServiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [detail, styleResult] = await Promise.all([fetchLookDetail(lookId), fetchLookStyles()]);
    if (styleResult.status === 'ok') setStyles(styleResult.value);
    if (detail.status !== 'ok') {
      setLoading(false);
      return setError(detail.message);
    }
    const found = detail.value;
    setLook(found);
    if (found) {
      const [signed, stats, bookable] = await Promise.all([
        signLookPhotos(found.photo_paths),
        fetchBarberLookStats(found.barber_id),
        found.service_id ? fetchBookableService(found.service_id) : Promise.resolve(null),
      ]);
      setUrls(signed);
      setStat(stats.status === 'ok' ? stats.value.find((row) => row.style === found.styles[0]) ?? null : null);
      setService(bookable);
    }
    setLoading(false);
  }, [lookId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const report = useCallback(async () => {
    if (!look || reported) return;
    const result = await reportUser({ target: { type: 'look', lookId: look.look_id }, reason: 'inappropriate_content' });
    if (result.status !== 'ok') return setError(result.message);
    setReported(true);
  }, [look, reported]);

  return { look, styles, urls, stat, service, loading, error, reported, report };
}
