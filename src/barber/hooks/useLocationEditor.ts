/**
 * State for the barber's base-location editor.
 *
 * Flow: the barber types their address → debounced Photon (free OSM) forward
 * geocoding → picks a candidate → saves. Saved coordinates are ALWAYS a
 * picked candidate's, never hand-typed, so every pin on the Explore map
 * traces back to a real geocode. Clearing the field and saving removes the
 * location entirely; the 0019 trigger then NULLs the display coordinates
 * and the barber's pin disappears (never a stale or fake pin).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { forwardGeocode, type GeocodeCandidate } from '../../shared/geocoding';
import { fetchOwnLocation, updateOwnLocation } from '../locationData';

/** Debounce for the geocode-as-you-type search. */
const SEARCH_DEBOUNCE_MS = 450;
/** Minimum characters before we bother the geocoder. */
export const MIN_QUERY_LENGTH = 4;

export function useLocationEditor(de: boolean, onSaved: () => void) {
  const [barberId, setBarberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [text, setText] = useState('');
  /** The candidate whose coordinates a save would store. Editing the text
   * away from its label invalidates it — coordinates are never stale. */
  const [selected, setSelected] = useState<GeocodeCandidate | null>(null);
  /** What is currently saved server-side (address + whether coords exist). */
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [savedHasCoords, setSavedHasCoords] = useState(false);

  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const savedRef = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    setLoadAttempt((n) => n + 1);
  }, []);

  // Mount fetch (plain useEffect — leaf editor, bio-edit C6 precedent).
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id ?? null;
      if (!active) return;
      setBarberId(id);
      if (!id) {
        setLoading(false);
        setLoadError(de ? 'Dein Konto wurde nicht gefunden. Melde dich ab und wieder an.' : 'We could not find your account. Try signing out and back in.');
        return;
      }
      const result = await fetchOwnLocation(id);
      if (!active) return;
      setLoading(false);
      if (result.status === 'ok') {
        const row = result.location;
        setText(row?.address ?? '');
        setSavedAddress(row?.address ?? null);
        const hasCoords = row?.latitude != null && row?.longitude != null;
        setSavedHasCoords(hasCoords);
        if (row && hasCoords && row.address) {
          // Seed the selection from the saved row so an untouched screen is
          // simply "not dirty" rather than "must re-pick".
          setSelected({ label: row.address, latitude: row.latitude!, longitude: row.longitude! });
        }
      } else {
        setLoadError(result.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadAttempt, de]);

  // Debounced geocode-as-you-type, driven entirely from the change handler
  // (no setState-in-effect): each keystroke cancels the pending timer, and a
  // sequence counter drops any response a newer keystroke superseded. Skips:
  // short input and input that equals the current selection's label.
  const searchSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSearch = useCallback(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    searchSeq.current += 1;
  }, []);

  // Unmount: no timer survives, no late response can set state.
  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

  const onChangeText = useCallback(
    (next: string) => {
      setText(next);
      setSearchError(null);
      setSearched(false);
      const query = next.trim();
      const stillSelected = selected !== null && query === selected.label;
      if (!stillSelected && selected !== null) setSelected(null);

      cancelPendingSearch();
      if (query.length < MIN_QUERY_LENGTH || stillSelected) {
        setCandidates([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const seq = searchSeq.current;
      searchTimer.current = setTimeout(() => {
        void forwardGeocode(query).then((result) => {
          if (seq !== searchSeq.current) return; // superseded or unmounted
          setSearching(false);
          setSearched(true);
          if (result.status === 'ok') {
            setCandidates(result.candidates);
          } else {
            setCandidates([]);
            setSearchError(result.message);
          }
        });
      }, SEARCH_DEBOUNCE_MS);
    },
    [selected, cancelPendingSearch]
  );

  const pickCandidate = useCallback(
    (candidate: GeocodeCandidate) => {
      cancelPendingSearch();
      setSelected(candidate);
      setText(candidate.label);
      setCandidates([]);
      setSearching(false);
      setSearched(false);
    },
    [cancelPendingSearch]
  );

  const trimmed = text.trim();
  const clearing = trimmed === '';
  const selectionCurrent = selected !== null && trimmed === selected.label;

  // Save rules: a clear is dirty when something is saved; a picked candidate
  // is dirty when it differs from what is saved. Free text with no picked
  // candidate is never saveable — coordinates only ever come from a geocode.
  const dirty = clearing
    ? savedAddress !== null || savedHasCoords
    : selectionCurrent && (selected.label !== savedAddress || !savedHasCoords);

  const onSave = useCallback(async () => {
    if (!barberId) return;
    setSubmitting(true);
    setFormError(null);
    const result = clearing
      ? await updateOwnLocation(barberId, { address: '', latitude: null, longitude: null })
      : await updateOwnLocation(barberId, { address: selected!.label, latitude: selected!.latitude, longitude: selected!.longitude });
    setSubmitting(false);
    if (result.status === 'ok') {
      savedRef.current = true;
      onSaved();
    } else {
      setFormError(result.message);
    }
  }, [barberId, clearing, selected, onSaved]);

  return {
    loading,
    loadError,
    retryLoad,
    text,
    trimmed,
    onChangeText,
    candidates,
    searching,
    searchError,
    searched,
    pickCandidate,
    formError,
    submitting,
    clearing,
    canSave: !loading && !submitting && barberId !== null && dirty,
    needsPick: !clearing && !selectionCurrent,
    hasUnsavedDraft: dirty || trimmed !== (savedAddress ?? '').trim(),
    savedRef,
    onSave,
  };
}
