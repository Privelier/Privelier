/**
 * Barber verification-document upload (Verify tab, build-order step 17).
 *
 * Two-step, in this exact order — orchestrated by the caller (the screen), not
 * here:
 *   1. `uploadVerificationDocument` puts the image bytes into the PRIVATE
 *      `verification-docs` bucket at `{userId}/{docType}.jpg` and returns the
 *      object PATH.
 *   2. `submitVerificationDocument` upserts that PATH into the barber's own
 *      `verification_requests` row.
 * The caller must only submit after the upload succeeds; a failed upload must
 * never reach step 2.
 *
 * Invariants (all DB/storage-enforced, mirrored here so nothing drifts):
 * - The DB columns store the object PATH (`{userId}/id.jpg`), NEVER a URL.
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
import { failure, logBarberDataError, mapPostgrestError } from './errors';
import type {
  SubmitVerificationDocumentResult,
  UploadVerificationDocumentResult,
} from './types';

/** Private Supabase Storage bucket for ID/license images. Never public. */
const VERIFICATION_BUCKET = 'verification-docs';

/**
 * Per-document-kind mapping to its storage filename and the single writable
 * column it lands in. Storage RLS scopes both objects to the barber's own
 * `{userId}/` folder; upsert overwrites, so re-uploading is idempotent.
 */
const DOC_TARGETS: Record<
  VerificationDocType,
  { readonly file: string; readonly column: 'id_image_url' | 'license_image_url' }
> = {
  id: { file: 'id.jpg', column: 'id_image_url' },
  license: { file: 'license.jpg', column: 'license_image_url' },
};

/** Minimal shape shared by a StorageError without importing its class. */
interface StorageErrorLike {
  message?: string | null;
}

/**
 * Map a Storage (bucket) error to a typed failure and log the raw details.
 * Styled after mapPostgrestError, but storage errors carry no PostgREST
 * `code`, so we classify by message text only:
 * - 'network' / 'failed to fetch' → network (retryable).
 * - permission / unauthorized / row-level security → forbidden.
 * - anything else → unknown.
 */
function mapStorageError(context: string, raw: StorageErrorLike | null): ReturnType<typeof failure> {
  logBarberDataError(context, raw);
  if (!raw) return failure('unknown');
  const msg = (raw.message ?? '').toLowerCase();
  if (msg.includes('network') || msg.includes('failed to fetch')) return failure('network');
  if (
    msg.includes('permission') ||
    msg.includes('unauthorized') ||
    msg.includes('row-level security')
  ) {
    return failure('forbidden');
  }
  return failure('unknown');
}

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
  const { file } = DOC_TARGETS[docType];
  const path = `${userId}/${file}`;

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
    .upload(path, bytes, { contentType: mimeType ?? 'image/jpeg', upsert: true });

  if (error) return mapStorageError('uploadVerificationDocument.upload', error);
  return { status: 'ok', path };
}

/**
 * Upsert the uploaded object PATH into the barber's own
 * `verification_requests` row (UNIQUE(user_id), so onConflict 'user_id').
 * Writes ONLY `user_id` + the one image column; `status` is set to 'pending'
 * by a DB trigger and must never be sent from the client.
 */
export async function submitVerificationDocument(
  userId: string,
  docType: VerificationDocType,
  path: string
): Promise<SubmitVerificationDocumentResult> {
  const { column } = DOC_TARGETS[docType];
  const payload = { user_id: userId, [column]: path };

  const { data, error } = await supabase
    .from('verification_requests')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return mapPostgrestError('submitVerificationDocument', error);
  return { status: 'ok', request: data as VerificationRequestRow };
}
