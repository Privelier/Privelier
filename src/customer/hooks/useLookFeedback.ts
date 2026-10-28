/**
 * The optional look-match answer on the review screen (Looks S2, behind the
 * 'looks' flag). The client picks the style they wanted (prefilled from the
 * barber's look for this booking, if any) and exact / close / miss. It is
 * sent after the review itself succeeded; its own failure never blocks the
 * review.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchLookForBooking, fetchLookStyles, submitLookFeedback } from '../../looks/looksData';
import type { LookStyle, LookVerdict } from '../../looks/types';

export function useLookFeedback(bookingId: string, enabled: boolean) {
  const [styles, setStyles] = useState<LookStyle[]>([]);
  const [style, setStyle] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<LookVerdict | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.all([fetchLookStyles(), fetchLookForBooking(bookingId)]).then(([styleResult, lookResult]) => {
      if (!active) return;
      if (styleResult.status === 'ok') setStyles(styleResult.value);
      if (lookResult.status === 'ok' && lookResult.value) {
        const first = lookResult.value.styles[0];
        setStyle((current) => current ?? first ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, [bookingId, enabled]);

  /** Best effort; true when an answer was recorded. */
  const submit = useCallback(async (): Promise<boolean> => {
    if (!enabled || !style || !verdict) return false;
    const result = await submitLookFeedback({ bookingId, style, verdict });
    return result.status === 'ok';
  }, [enabled, style, verdict, bookingId]);

  return { styles, style, setStyle, verdict, setVerdict, submit };
}
