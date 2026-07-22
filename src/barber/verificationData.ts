/**
 * Barber verification-document upload (Verify tab, build-order step 17).
 *
 * Two-step, in this exact order — orchestrated by the caller (the screen), not
 * here:
 *   1. `uploadVerificationDocument` puts the image bytes into the PRIVATE
 *      `verification-docs` bucket at a UNIQUE `{userId}/{docType}-{stamp}.jpg`
 *      path (never a fixed name — see uniqueObjectName) and returns the PATH.
 *   2. `submitVerificationDocument` writes that PATH into the barber's own
 *      `verification_requests` row (UPDATE if it exists, else INSERT — never
 *      an upsert; see that function).
 * The caller must only submit after the upload succeeds; a failed upload must
 * never reach step 2.
 *
 * Invariants (all DB/storage-enforced, mirrored here so nothing drifts):
 * - The DB columns store the object PATH (`{userId}/id-{stamp}.jpg`), NEVER a URL.
 *   This module never builds a public URL and never calls createSignedUrl.
 * - `status` (and `reviewed_by` / `reviewed_at`) are DB-trigger-owned: any
 *   client image write flips `status` to 'pending' automatically. The client
 *   may write ONLY `id_image_url` / `license_image_url` (column-level grant),
 *   so this module never sends `status` / `reviewed_by` / `reviewed_at` —
 *   doing so errors at the privilege layer.
 * - `barber_profile` is NEVER touched here (hard rule — its verification
 *   columns are admin-owned).
 */
import { supabase } from '../../lib/supabase';
import type { VerificationDocType, VerificationRequestRow } from '../types';
import { uniqueObjectName } from '../shared/objectNames';
import { failure, logBarberDataError, mapPostgrestError, mapStorageError } from './errors';
import type {
  SubmitVerificationDocumentResult,
  UploadVerificationDocumentResult,
} from './types';

/** Private Supabase Storage bucket for ID/license images. Never public. */
const VERIFICATION_BUCKET = 'verification-docs';

/**
 * Per-document-kind mapping to its storage filename prefix and the single
 * writable column it lands in. Storage RLS scopes every object to the barber's
 * own `{userId}/` folder. Each upload gets a UNIQUE object name (see
 * uniqueObjectName) — this module never overwrites an object in place.
 */
const DOC_TARGETS: Record<
  VerificationDocType,
  { readonly prefix: string; readonly column: 'id_image_url' | 'license_image_url' }
> = {
  id: { prefix: 'id', column: 'id_image_url' },
  license: { prefix: 'license', column: 'license_image_url' },
};

/**
 * Object names come from the shared `uniqueObjectName` (src/shared/objectNames):
 * a fresh, UNGUESSABLE name per upload. A DETERMINISTIC path plus
 * upsert would break two guarantees (security-auditor finding, Step 17 gate):
 *  1. Re-queue — the DB trigger re-queues a resubmission only when the stored
 *     image-column value changes. A fixed path is byte-identical across
 *     re-uploads, so a rejected barber's resubmission would silently never
 *     re-enter the founders' manual queue.
 *  2. Approved-doc integrity — storage RLS gates on folder ownership, not on
 *     status, so a fixed path lets an approved barber overwrite the reviewed
 *     bytes in place with no signal.
 * A unique name per upload fixes both: the column value genuinely changes (the
 * trigger fires), and a superseded/approved object is never overwritten — it
 * just becomes an orphan in the barber's own private folder (MVP-acceptable; a
 * service-role cleanup is a later job).
 */

/**
 * Upload one verification image to the private bucket at
 * `{userId}/{docType}.jpg` and return its object PATH.
 *
 * `fileUri` is a local (device) URI from the image picker. On success returns
 * `{ status: 'ok', path }`; the caller then passes that path to
 * `submitVerificationDocument`.
 */
export async function uploadVerificationDocument(
  userId: string,
  docType: VerificationDocType,
  fileUri: string,
  mimeType?: string
): Promise<UploadVerificationDocumentResult> {
  const { prefix } = DOC_TARGETS[docType];
  const path = `${userId}/${uniqueObjectName(prefix)}`;

  // Reading local file bytes via fetch(uri).arrayBuffer() is the Expo/RN
  // pattern for turning a device file URI into an uploadable body. It is the
  // one thing here that can only be confirmed on-device once the dev-client is
  // rebuilt with the image picker; a fetch/read failure is treated as network.
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(fileUri);
    bytes = await res.arrayBuffer();
  } catch (err) {
    logBarberDataError('uploadVerificationDocument.read', err);
    return failure('network');
  }

  const { error } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    // No upsert: the path is unique per upload, so there is nothing to overwrite
    // (deliberate — see uniqueObjectName).
    .upload(path, bytes, { contentType: mimeType ?? 'image/jpeg' });

  if (error) return mapStorageError('uploadVerificationDocument.upload', error);
  return { status: 'ok', path };
}

/** Postgres unique_violation — here only ever UNIQUE(user_id). */
const UNIQUE_VIOLATION = '23505';

/**
 * UPDATE the one image column on the barber's own row.
 * Resolves to `null` when no row matched, which means either "no row yet"
 * (first submission) or "a row exists that `verification_requests_update_own`
 * won't match" (already approved — the policy is scoped to pending/rejected).
 * The caller distinguishes the two.
 */
async function updateOwnDocumentColumn(
  userId: string,
  column: 'id_image_url' | 'license_image_url',
  path: string
): Promise<SubmitVerificationDocumentResult | null> {
  const { data, error } = await supabase
    .from('verification_requests')
    .update({ [column]: path })
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) return mapPostgrestError('submitVerificationDocument.update', error);
  if (!data) return null;
  return { status: 'ok', request: data as VerificationRequestRow };
}

/**
 * Write the uploaded object PATH into the barber's own `verification_requests`
 * row: UPDATE the image column if the row exists, else INSERT the first one.
 *
 * NOT an upsert, deliberately. PostgREST compiles `.upsert({ user_id, ... })`
 * to `ON CONFLICT (user_id) DO UPDATE SET user_id = excluded.user_id, ...`,
 * and `authenticated` holds UPDATE on ONLY the two image columns (0015's
 * column-grant guardrail) — never on `user_id`. So the conflict arm raised
 * 42501 and every RESUBMISSION failed, while first submissions (the INSERT
 * arm, which does hold INSERT on `user_id`) worked. Splitting the two paths
 * keeps each write inside the columns the client is actually granted; do not
 * collapse this back into an upsert.
 *
 * `status` / `reviewed_by` / `reviewed_at` are never sent — `status` is flipped
 * to 'pending' by the re-queue trigger whenever an image column changes.
 */
export async function submitVerificationDocument(
  userId: string,
  docType: VerificationDocType,
  path: string
): Promise<SubmitVerificationDocumentResult> {
  const { column } = DOC_TARGETS[docType];

  const updated = await updateOwnDocumentColumn(userId, column, path);
  if (updated) return updated;

  const { data, error } = await supabase
    .from('verification_requests')
    .insert({ user_id: userId, [column]: path })
    .select()
    .single();

  if (!error) return { status: 'ok', request: data as VerificationRequestRow };

  if (error.code === UNIQUE_VIOLATION) {
    // A row appeared between our UPDATE and INSERT — retry the update once.
    const retried = await updateOwnDocumentColumn(userId, column, path);
    if (retried) return retried;
    // Still no match: the row exists but is out of the update policy's
    // pending/rejected scope. A real denial, not a race.
    logBarberDataError('submitVerificationDocument.insert', error);
    return failure('forbidden');
  }

  return mapPostgrestError('submitVerificationDocument.insert', error);
}
