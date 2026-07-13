/**
 * Cross-app portfolio image read helper (build-order step 17, design D2/D6).
 *
 * The `portfolio` bucket is PUBLIC (design D1), so an object's bytes are
 * served by a stable public URL with no auth and no expiry. The DB stores the
 * object PATH (`{barberId}/{unique}.jpg`), never a baked URL, so the client
 * derives the URL synchronously here. This lives in src/shared/ because BOTH
 * apps consume it — the barber's own grid (PortfolioScreen) and the
 * customer's BarberProfileScreen Portfolio tab.
 *
 * Dependency-clean by design: it imports only the Supabase client, never a
 * screen or a per-app data module (dependency direction stays one-way).
 */
import { supabase } from '../../lib/supabase';

/**
 * Derive the public URL for a portfolio object PATH. Synchronous — no network
 * call, no signing, no expiry (the bucket is public). Pass the value stored in
 * `portfolio.image_url`.
 */
export function getPublicPortfolioUrl(path: string): string {
  return supabase.storage.from('portfolio').getPublicUrl(path).data.publicUrl;
}
