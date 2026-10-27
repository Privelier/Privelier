/**
 * The booking write for the confirm step.
 *
 * The address is geocoded once (free Photon) on a best-effort basis: a miss
 * never blocks the booking, it only means no live-arrival map for it.
 *
 * insertBooking's result arms are handled distinctly:
 * - 'ok': the authoritative inserted row (price snapshot, id, status) drives
 *   the success state, so nothing on it is a client-side guess;
 * - 'conflict' / 'slot_unavailable': the slot is gone (an overlapping booking,
 *   the time passed, or availability changed). Flagged as a conflict so the
 *   screen offers "choose another time" instead of a blind retry;
 * - any other failure: its own message.
 *
 * One idempotency key per visit: a retry after a lost response returns the
 * booking the first attempt created (create_booking, migration 0054).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { haptics } from '../../shared/haptics';
import { geocodeBestMatch } from '../../shared/geocoding';
import { askForPushPermissionInContext } from '../../shared/push';
import type { BookingRow } from '../../types';
import { insertBooking } from '../bookingCreateData';
import type { AddressPinState } from '../components/AddressPinPreview';
import { customerDataErrorCopy } from '../errors';

interface BookingRequestInput {
  serviceId: string;
  date: string;
  time: string;
  location: string;
  geocodeQuery?: string;
}

export function useBookingRequest({ serviceId, date, time, location, geocodeQuery }: BookingRequestInput, de: boolean) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<BookingRow | null>(null);
  const [conflict, setConflict] = useState(false);
  // Same-tick double-tap guard: `submitting` only disables the button after
  // the next commit, and a second insert would race the first one.
  const submittingRef = useRef(false);
  const [idempotencyKey] = useState(() => Crypto.randomUUID());
  const [pin, setPin] = useState<AddressPinState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void geocodeBestMatch(geocodeQuery ?? location).then((candidate) => {
      if (active) setPin(candidate ? { status: 'found', candidate } : { status: 'none' });
    });
    return () => {
      active = false;
    };
  }, [geocodeQuery, location]);

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    void haptics.confirm();
    setSubmitting(true);
    setError(null);
    setConflict(false);
    const result = await insertBooking({
      serviceId,
      date,
      time,
      location,
      coordinates: pin.status === 'found' ? pin.candidate : null,
      idempotencyKey,
    });
    submittingRef.current = false;
    setSubmitting(false);

    if (result.status === 'ok') {
      setCreated(result.booking);
      void haptics.success();
      // The moment push is obviously useful: "tell me when they accept and
      // when they are on the way". Asked once, never at app entry.
      void askForPushPermissionInContext();
      return;
    }
    if (result.status === 'conflict' || result.status === 'slot_unavailable') {
      void haptics.warning();
      setConflict(true);
      if (result.status === 'conflict') {
        setError(de ? 'Diese Uhrzeit wurde gerade von jemand anderem gebucht. Wähle eine andere Uhrzeit.' : customerDataErrorCopy.conflict);
      } else {
        setError(de ? 'Diese Uhrzeit ist nicht mehr verfügbar. Wähle eine andere Uhrzeit.' : 'That time is no longer available. Pick another time.');
      }
      return;
    }
    setError(result.message);
  }, [serviceId, date, time, location, pin, de, idempotencyKey]);

  return { submitting, error, created, conflict, pin, submit };
}
