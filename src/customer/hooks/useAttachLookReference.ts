/**
 * "Book this look" (Looks S3 to S5): once the normal booking request exists,
 * link it to what it was made for, exactly once: a barber's offer on a wish
 * (accept_offer, which also attaches the wish's style and photo) or a look
 * or searched style (attach_look_reference). Best effort: the booking is
 * already created and stays valid if this fails (the barber then simply sees
 * no reference). Without a reference this hook does nothing, so the solo
 * booking flow is unchanged.
 */
import { useEffect, useRef } from 'react';
import { attachLookReference } from '../../looks/looksData';
import { acceptOffer } from '../../looks/wishData';
import type { BookingRow } from '../../types';
import type { LookReferenceParam } from '../CustomerNavigator';

export function useAttachLookReference(created: BookingRow | null, reference: LookReferenceParam | undefined): void {
  const attachedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!created || !reference || attachedFor.current === created.id) return;
    attachedFor.current = created.id;
    if (reference.offerId) {
      void acceptOffer(reference.offerId, created.id);
      return;
    }
    void attachLookReference({ bookingId: created.id, lookId: reference.lookId, style: reference.style, photoPath: reference.photoPath });
  }, [created, reference]);
}
