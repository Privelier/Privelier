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
import type { ServiceRow } from '../types';
import type { BarberLookStat, FeedLook, Look, LookMatch, LookPhoto, LookReference, LookStyle, LookVerdict } from './types';

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
export function signLookPhotos(paths: string[]): Promise<Map<string, string>> {
  return signPaths(LOOKS_BUCKET, paths);
}

async function signPaths(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) {
    devWarn(`[looks] sign ${bucket}`, error);
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

const FEED_PAGE = 12;

/** Published looks in the caller's city, newest first (customers only). */
export async function fetchLooksFeed(input: { style?: string | null; before?: string | null } = {}): Promise<LooksResult<FeedLook[]>> {
  const { data, error } = await untypedRpc<FeedLook[]>('looks_feed', {
    p_style: input.style ?? null,
    p_before: input.before ?? null,
    p_limit: FEED_PAGE,
  });
  if (error) return mapLooksError('fetchLooksFeed', error);
  return ok(Array.isArray(data) ? data : []);
}

/** One published look with its proof chain, or null when it is gone. */
export async function fetchLookDetail(lookId: string): Promise<LooksResult<FeedLook | null>> {
  const { data, error } = await untypedRpc<FeedLook[]>('looks_feed', { p_look_id: lookId, p_limit: 1 });
  if (error) return mapLooksError('fetchLookDetail', error);
  return ok(Array.isArray(data) && data.length > 0 ? data[0] : null);
}

/** Link a just-created pending booking to the look (and photo) it was made for. */
export async function attachLookReference(input: { bookingId: string; lookId: string | null; style: string; photoPath?: string | null }): Promise<LooksResult<null>> {
  const { error } = await untypedRpc<LookReference>('attach_look_reference', {
    p_booking_id: input.bookingId,
    p_look_id: input.lookId,
    p_style: input.style,
    // Sent only when present, so the call also matches the 0065 signature.
    ...(input.photoPath ? { p_photo_path: input.photoPath } : {}),
  });
  if (error) return mapLooksError('attachLookReference', error);
  return ok(null);
}

/**
 * The look a booking was made for (booking participants only). `*` because
 * photo_path exists from 0066 on; the read keeps working on 0065 alone.
 */
export async function fetchLookReference(bookingId: string): Promise<LooksResult<LookReference | null>> {
  const { data, error } = await untypedTable('look_references').select('*').eq('booking_id', bookingId).maybeSingle();
  if (error) return mapLooksError('fetchLookReference', error);
  return ok((data as LookReference | null) ?? null);
}

export interface PortfolioFallbackTile {
  id: string;
  barber_id: string;
  image_url: string;
}

/**
 * Portfolio images of approved barbers already shown in Discover, used to
 * fill a thin feed. Always labelled "portfolio, not verified" in the UI.
 */
export async function fetchPortfolioFallback(barberIds: string[]): Promise<PortfolioFallbackTile[]> {
  if (barberIds.length === 0) return [];
  const { data, error } = await supabase.from('portfolio').select('id, barber_id, image_url').in('barber_id', barberIds.slice(0, 12)).limit(6);
  if (error) {
    devWarn('[looks] fetchPortfolioFallback', error);
    return [];
  }
  return (data ?? []).filter((row): row is PortfolioFallbackTile => Boolean(row.barber_id && row.image_url));
}

/** The look's service, if the barber still offers it (RLS: approved barbers). */
export async function fetchBookableService(serviceId: string): Promise<ServiceRow | null> {
  const { data, error } = await supabase.from('services').select('*').eq('id', serviceId).maybeSingle();
  if (error) devWarn('[looks] fetchBookableService', error);
  return (data as ServiceRow | null) ?? null;
}

const REFERENCE_BUCKET = 'look-references';

/** Upload the client's own reference photo into their private folder. */
export async function uploadReferencePhoto(fileUri: string): Promise<LooksResult<string>> {
  const { data } = await supabase.auth.getSession();
  const customerId = data.session?.user.id;
  if (!customerId) return looksFailure('forbidden');
  const path = `${customerId}/${uniqueObjectName('ref')}`;
  let image: Awaited<ReturnType<typeof readNormalizedImage>>;
  try {
    image = await readNormalizedImage(fileUri);
  } catch (err) {
    devWarn('[looks] uploadReferencePhoto.read', err);
    return looksFailure('network');
  }
  const { error } = await supabase.storage.from(REFERENCE_BUCKET).upload(path, image.bytes, { contentType: image.contentType });
  if (error) return mapLooksError('uploadReferencePhoto', { message: error.message });
  return ok(path);
}

/** A short-lived URL for a booking's reference photo (its client or booked barber). */
export async function signReferencePhoto(path: string): Promise<string | null> {
  return (await signPaths(REFERENCE_BUCKET, [path])).get(path) ?? null;
}

/** Remove a reference photo the client took back before booking (best effort). */
export async function removeReferencePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(REFERENCE_BUCKET).remove([path]);
  if (error) devWarn('[looks] removeReferencePhoto', error);
}

/** Barbers with proof in the style who are free in the window (0066). */
export async function matchLook(input: { style: string; date: string; from: string; to: string }): Promise<LooksResult<LookMatch[]>> {
  const { data, error } = await untypedRpc<LookMatch[]>('match_look', {
    p_style: input.style,
    p_date: input.date,
    p_from: input.from,
    p_to: input.to,
  });
  if (error) return mapLooksError('matchLook', error);
  return ok(Array.isArray(data) ? data : []);
}

/** Test seam: forget the cached style list. */
export function resetLookStylesCache(): void {
  stylesCache = null;
}
