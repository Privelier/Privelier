/**
 * Looks data layer shared by both apps (migrations 0063 and 0064).
 *
 * Reads use RLS on looks / look_photos / look_feedback: the barber sees their
 * own looks, the customer sees a look once it was sent to them. Every write
 * is a SECURITY DEFINER function that re-checks the feature flag, the actor,
 * the booking and the look's state, so nothing here is trusted.
 *
 * Photos: the barber picks them with the system photo picker; each is
 * re-encoded (EXIF and GPS dropped, see imageUpload) and uploaded to the
 * PRIVATE `looks` bucket under the barber's folder, then attached with
 * add_look_photo. They are shown through short-lived signed URLs. Files of a
 * look that is not shown are removed best effort right after the answer;
 * RLS hides any file the app could not remove.
 */
import { supabase } from '../../lib/supabase';
import { devWarn } from '../shared/devLog';
import { buildFailure, classifyPostgrestError, isNetworkMessage, sharedDataErrorCopy, UNIQUE_VIOLATION, type DataFailure, type PostgrestErrorLike } from '../shared/dataErrors';
import { readNormalizedImage } from '../shared/imageUpload';
import { uniqueObjectName } from '../shared/objectNames';
import { untypedRpc, untypedTable } from '../shared/untypedRpc';
import type { BarberLookStat, Look, LookPhoto, LookStyle, LookVerdict } from './types';

const LOOKS_BUCKET = 'looks';
const SIGNED_URL_SECONDS = 600;
const LOOK_COLUMNS =
  'id, booking_id, barber_id, customer_id, service_id, styles, status, no_face_confirmed, submitted_at, responded_at, consented_at, created_at, look_photos(id, look_id, storage_path, position)';

type LooksErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'state_changed'
  | 'already_done'
  | 'limit_reached'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export type LooksFailure = DataFailure<LooksErrorCode>;
export type LooksResult<T> = { status: 'ok'; value: T } | LooksFailure;

const { blocked_language: _unusedEn, ...sharedEn } = sharedDataErrorCopy.en;
const { blocked_language: _unusedDe, ...sharedDe } = sharedDataErrorCopy.de;

const looksErrorCopy = {
  en: {
    ...sharedEn,
    invalid_input: 'Pick one to three styles and at least one photo.',
    not_found: 'This look is no longer available.',
    state_changed: 'This look has already moved on. Refresh to see where it stands.',
    already_done: 'You have already answered this.',
  },
  de: {
    ...sharedDe,
    invalid_input: 'Wähle ein bis drei Stile und mindestens ein Foto.',
    not_found: 'Dieser Look ist nicht mehr verfügbar.',
    state_changed: 'Dieser Look ist schon weiter. Aktualisiere, um den Stand zu sehen.',
    already_done: 'Das hast du bereits beantwortet.',
  },
} satisfies Record<'en' | 'de', Record<LooksErrorCode, string>>;

function looksFailure(code: LooksErrorCode): LooksFailure {
  return buildFailure(code, looksErrorCopy);
}

/** Map a server error to calm copy; raw text goes to the dev log only. */
export function mapLooksError(context: string, raw: PostgrestErrorLike | null): LooksFailure {
  devWarn(`[looks] ${context}`, raw);
  switch (raw?.code) {
    case 'P0002':
      return looksFailure('not_found');
    case 'P0001':
      return looksFailure('state_changed');
    case '22023':
      return looksFailure('invalid_input');
    case UNIQUE_VIOLATION:
      return looksFailure('already_done');
  }
  const kind = classifyPostgrestError(raw);
  if (kind === 'forbidden' || kind === 'rate_limited' || kind === 'limit_reached' || kind === 'network') {
    return looksFailure(kind);
  }
  if (kind === 'invalid_input') return looksFailure('invalid_input');
  return looksFailure(isNetworkMessage(raw?.message) ? 'network' : 'unknown');
}

function ok<T>(value: T): LooksResult<T> {
  return { status: 'ok', value };
}

let stylesCache: LookStyle[] | null = null;

/** The fixed style list, cached for the session once it loaded. */
export async function fetchLookStyles(): Promise<LooksResult<LookStyle[]>> {
  if (stylesCache) return ok(stylesCache);
  const { data, error } = await untypedTable('look_styles')
    .select('key, label_en, label_de, sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) return mapLooksError('fetchLookStyles', error);
  const styles = (Array.isArray(data) ? data : []) as LookStyle[];
  if (styles.length > 0) stylesCache = styles;
  return ok(styles);
}

/** The look of one booking (or null), with its photos in order. */
export async function fetchLookForBooking(bookingId: string): Promise<LooksResult<Look | null>> {
  const { data, error } = await untypedTable('looks').select(LOOK_COLUMNS).eq('booking_id', bookingId).maybeSingle();
  if (error) return mapLooksError('fetchLookForBooking', error);
  if (!data) return ok(null);
  const look = data as Look;
  const photos = Array.isArray(look.look_photos) ? [...look.look_photos] : [];
  photos.sort((a, b) => a.position - b.position);
  return ok({ ...look, look_photos: photos });
}

export async function saveLookDraft(input: { bookingId: string; styles: string[]; noFace: boolean }): Promise<LooksResult<Look>> {
  const { data, error } = await untypedRpc<Look>('create_look_draft', {
    p_booking_id: input.bookingId,
    p_styles: input.styles,
    p_no_face: input.noFace,
  });
  if (error || !data) return mapLooksError('saveLookDraft', error);
  return ok({ ...data, look_photos: [] });
}

/** Upload one picked photo into the barber's own folder; returns its path. */
export async function uploadLookPhoto(barberId: string, fileUri: string): Promise<LooksResult<string>> {
  const path = `${barberId}/${uniqueObjectName('look')}`;
  let image: Awaited<ReturnType<typeof readNormalizedImage>>;
  try {
    image = await readNormalizedImage(fileUri);
  } catch (err) {
    devWarn('[looks] uploadLookPhoto.read', err);
    return looksFailure('network');
  }
  const { error } = await supabase.storage.from(LOOKS_BUCKET).upload(path, image.bytes, { contentType: image.contentType });
  if (error) return mapLooksError('uploadLookPhoto', { message: error.message });
  return ok(path);
}

export async function attachLookPhoto(lookId: string, path: string): Promise<LooksResult<LookPhoto>> {
  const { data, error } = await untypedRpc<LookPhoto>('add_look_photo', { p_look_id: lookId, p_storage_path: path });
  if (error || !data) return mapLooksError('attachLookPhoto', error);
  return ok(data);
}

/** Remove files best effort; RLS already hides them from everyone else. */
async function removeLookFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(LOOKS_BUCKET).remove(paths);
  if (error) devWarn('[looks] removeLookFiles', error);
}

export async function removeLookPhoto(photo: LookPhoto): Promise<LooksResult<null>> {
  const { error } = await untypedRpc<null>('remove_look_photo', { p_photo_id: photo.id });
  if (error) return mapLooksError('removeLookPhoto', error);
  await removeLookFiles([photo.storage_path]);
  return ok(null);
}

export async function sendLook(lookId: string): Promise<LooksResult<null>> {
  const { error } = await untypedRpc<Look>('submit_look', { p_look_id: lookId });
  if (error) return mapLooksError('sendLook', error);
  return ok(null);
}

/** The customer's answer. Files of a look that will not be shown are removed. */
export async function answerLook(look: Look, answer: { isMine: boolean; show: boolean }): Promise<LooksResult<Look>> {
  const { data, error } = await untypedRpc<Look>('respond_to_look', {
    p_look_id: look.id,
    p_is_mine: answer.isMine,
    p_show: answer.isMine && answer.show,
  });
  if (error || !data) return mapLooksError('answerLook', error);
  if (data.status !== 'published') await removeLookFiles(look.look_photos.map((photo) => photo.storage_path));
  return ok({ ...data, look_photos: look.look_photos });
}

/** 'hide': stop showing (still counts). 'withdraw': take it back entirely. */
export async function takeBackLook(look: Look, mode: 'hide' | 'withdraw'): Promise<LooksResult<Look>> {
  const { data, error } = await untypedRpc<Look>('withdraw_look', { p_look_id: look.id, p_mode: mode });
  if (error || !data) return mapLooksError('takeBackLook', error);
  await removeLookFiles(look.look_photos.map((photo) => photo.storage_path));
  return ok({ ...data, look_photos: look.look_photos });
}

/** Short-lived signed URLs by path; a failure leaves the map empty. */
export async function signLookPhotos(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await supabase.storage.from(LOOKS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) {
    devWarn('[looks] signLookPhotos', error);
    return urls;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export async function submitLookFeedback(input: { bookingId: string; style: string; verdict: LookVerdict }): Promise<LooksResult<null>> {
  const { error } = await untypedRpc<null>('submit_look_feedback', {
    p_booking_id: input.bookingId,
    p_style: input.style,
    p_verdict: input.verdict,
  });
  if (error) return mapLooksError('submitLookFeedback', error);
  return ok(null);
}

export async function fetchBarberLookStats(barberId: string): Promise<LooksResult<BarberLookStat[]>> {
  const { data, error } = await untypedRpc<BarberLookStat[]>('barber_look_stats', { p_barber_id: barberId });
  if (error) return mapLooksError('fetchBarberLookStats', error);
  return ok(Array.isArray(data) ? data : []);
}

/** Test seam: forget the cached style list. */
export function resetLookStylesCache(): void {
  stylesCache = null;
}
