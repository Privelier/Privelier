/**
 * Collision-resistant, UNGUESSABLE storage object-name generator, shared by the
 * two upload paths (portfolio images + verification documents) that previously
 * each carried an identical `Math.random()`-based helper.
 *
 * WHY A CSPRNG (portfolio security finding L2, 2026-07-14): `Math.random()` is
 * not cryptographically strong. On the PUBLIC `portfolio` bucket the object name
 * is the ONLY barrier against an unauthenticated caller guessing/enumerating an
 * image URL, so its random segment must be unguessable. The private
 * `verification-docs` bucket is lower-risk (read is RLS-gated) but shares the
 * helper, so it is hardened in the same move.
 *
 * `crypto.getRandomValues` is polyfilled app-wide by
 * `react-native-get-random-values` (already a dependency, imported at app boot
 * via lib/secureStorage). It is re-imported here for the side effect so this
 * module is correct regardless of import order; the import is idempotent.
 */
import 'react-native-get-random-values';

/** A lowercase-hex token of `byteLength` CSPRNG bytes (default 12 = 96 bits). */
function randomToken(byteLength = 12): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * `{prefix}-{timestamp}-{random}.jpg`. The timestamp only aids human/debug
 * ordering; the CSPRNG token is what makes the name unguessable. Always a fresh
 * name — no upload ever overwrites another object in place.
 */
export function uniqueObjectName(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomToken()}.jpg`;
}
