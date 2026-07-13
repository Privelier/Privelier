/**
 * Barber portfolio data layer (Portfolio tab, build-order step 17).
 *
 * Upload/delete follow the verificationData.ts template: a two-step,
 * caller-orchestrated upload-then-write (never write a row for an object that
 * failed to upload), unique object names (never a fixed path, never an
 * in-place overwrite), and the DB column stores the object PATH, never a URL
 * (design D2/D3). Unlike verification, portfolio images are read by customers
 * in-app via a PUBLIC bucket — that read path lives in src/shared/
 * portfolioImages.ts, not here.
 *
 * The max-6 constraint is DB-enforced per barber_id by the
 * `enforce_portfolio_max_six` trigger; MAX_PORTFOLIO_IMAGES exists so the UI
 * can show the "N of 6" counter and hide the add tile at the cap, and
 * `insertPortfolioRow` maps the trigger's raised exception to a typed
 * 'limit_reached' failure so the UI shows honest copy rather than a generic
 * error (design D5).
 */
import { supabase } from '../../lib/supabase';
import type { PortfolioRow } from '../types';
import { failure, logBarberDataError, mapPostgrestError, mapStorageError } from './errors';
import type {
  CreatePortfolioResult,
  DeletePortfolioImageResult,
  ListOwnPortfolioResult,
  UploadPortfolioImageResult,
} from './types';

/** Mirror of the DB's hard cap (see CLAUDE.md schema: max 6 per barber). */
export const MAX_PORTFOLIO_IMAGES = 6;

/**
 * PUBLIC Supabase Storage bucket for portfolio images (design D1). Object
 * bytes are world-readable by URL; the security boundary is storage RLS on
 * INSERT/DELETE (owner folder + barber role), not read. Enumeration is
 * mitigated by unique random object names (see uniqueObjectName).
 */
const PORTFOLIO_BUCKET = 'portfolio';

/**
 * A fresh, collision-resistant object name per upload — same shape as
 * verificationData.ts. Unique names (never a fixed path) mean no upload ever
 * overwrites another object in place, so a superseded image simply becomes an
 * orphan in the barber's own folder (MVP-acceptable, design D4) rather than
 * clobbering live bytes.
 */
function uniqueObjectName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
}

/** Postgres raise_exception SQLSTATE — the max-6 trigger raises this. */
const RAISE_EXCEPTION = 'P0001';
/** Fragment of `enforce_portfolio_max_six`'s RAISE message. */
const MAX_SIX_MESSAGE = 'more than 6 portfolio images';

/** The signed-in barber's portfolio images. */
export async function listOwnPortfolio(barberId: string): Promise<ListOwnPortfolioResult> {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('barber_id', barberId);

  if (error) return mapPostgrestError('listOwnPortfolio', error);
  return { status: 'ok', images: (data as PortfolioRow[]) ?? [] };
}

/**
 * Upload one portfolio image to the PUBLIC `portfolio` bucket at a UNIQUE
 * `{barberId}/{unique}.jpg` path and return its object PATH. `fileUri` is a
 * local (device) URI from the image picker; on success returns
 * `{ status: 'ok', path }` and the caller then passes that path to
 * `insertPortfolioRow`. A failed upload must never reach the row insert.
 */
export async function uploadPortfolioImage(
  barberId: string,
  fileUri: string,
  mimeType?: string
): Promise<UploadPortfolioImageResult> {
  const path = `${barberId}/${uniqueObjectName('img')}`;

  // Reading local file bytes via fetch(uri).arrayBuffer() is the Expo/RN
  // pattern for turning a device file URI into an uploadable body; a
  // fetch/read failure is treated as network (retryable).
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(fileUri);
    bytes = await res.arrayBuffer();
  } catch (err) {
    logBarberDataError('uploadPortfolioImage.read', err);
    return failure('network');
  }

  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    // No upsert: the path is unique per upload, so there is nothing to
    // overwrite (deliberate — see uniqueObjectName).
    .upload(path, bytes, { contentType: mimeType ?? 'image/jpeg' });

  if (error) return mapStorageError('uploadPortfolioImage.upload', error);
  return { status: 'ok', path };
}

/**
 * Insert a portfolio row pointing at an already-uploaded object PATH. Writes
 * only `barber_id` + `image_url = path`; RLS (`portfolio_write_own`) scopes
 * the insert to the owner. The `enforce_portfolio_max_six` trigger RAISEs
 * (SQLSTATE P0001, message contains "more than 6 portfolio images") when the
 * barber already holds 6 images — that specific case is surfaced as a typed
 * 'limit_reached' failure (not generic) so the UI can show honest at-the-cap
 * copy; every other error goes through mapPostgrestError.
 */
export async function insertPortfolioRow(
  barberId: string,
  path: string
): Promise<CreatePortfolioResult> {
  const { data, error } = await supabase
    .from('portfolio')
    .insert({ barber_id: barberId, image_url: path })
    .select()
    .single();

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (error.code === RAISE_EXCEPTION && msg.includes(MAX_SIX_MESSAGE)) {
      logBarberDataError('insertPortfolioRow.limit', error);
      return failure('limit_reached');
    }
    return mapPostgrestError('insertPortfolioRow', error);
  }
  return { status: 'ok', image: data as PortfolioRow };
}

/**
 * Delete a portfolio image: DB row FIRST, then a best-effort storage-object
 * delete (design D5). If the row delete errors, the object is left untouched
 * and the failure is returned. Once the row is gone the image is absent from
 * every read path (which is what the user asked for), so a storage-object
 * delete failure is logged and accepted as an orphan (design D4) — the row is
 * NOT rolled back and the caller still sees `{ status: 'ok' }`.
 */
export async function deletePortfolioImage(
  image: PortfolioRow
): Promise<DeletePortfolioImageResult> {
  const { error } = await supabase.from('portfolio').delete().eq('id', image.id);
  if (error) return mapPostgrestError('deletePortfolioImage.row', error);

  // Best-effort: the row is already gone, so a storage failure only leaves an
  // invisible orphan object (storage-cost only, no read-path/security impact).
  const { error: storageError } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .remove([image.image_url]);
  if (storageError) {
    logBarberDataError('deletePortfolioImage.object', storageError);
  }
  return { status: 'ok' };
}
