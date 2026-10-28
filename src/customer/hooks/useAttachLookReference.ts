/**
 * "Book this look" (Looks S3): once the normal booking request exists, link
 * it to the look it was made for, exactly once. Best effort: the booking is
 * already created and stays valid if this fails (the barber then simply sees
 * no reference). Without a reference this hook does nothing, so the solo
 * booking flow is unchanged.
 */
import { useEffect, useRef } from 'react';
import { attachLookReference } from '../../looks/looksData';
import type { BookingRow } from '../../types';
import type { LookReferenceParam } from '../CustomerNavigator';

export function useAttachLookReference(created: BookingRow | null, reference: LookReferenceParam | undefined): void {
  const attachedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!created || !reference || attachedFor.current === created.id) return;
    attachedFor.current = created.id;
    void attachLookReference({ bookingId: created.id, lookId: reference.lookId, style: reference.style });
  }, [created, reference]);
}
