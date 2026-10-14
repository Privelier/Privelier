/**
 * Barber profile links: `privelier://barber/<uuid>`.
 *
 * The Customer app opens the profile; if the link launched the app before
 * sign-in, the Customer navigator picks it up once it mounts after login.
 * Each link is handled once per app session so signing out and back in does
 * not replay it. Only a well-formed UUID path is accepted — anything else is
 * ignored, never navigated to.
 */
import * as Linking from 'expo-linking';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function barberProfileLink(barberId: string): string {
  return `privelier://barber/${barberId}`;
}

/** The barber id in a profile link, or null for anything else. */
export function parseBarberProfileLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'privelier:') return null;
    // privelier://barber/<id> parses as host "barber", path "/<id>".
    const parts = [parsed.host, ...parsed.pathname.split('/')].filter(Boolean);
    if (parts.length !== 2 || parts[0] !== 'barber' || !UUID.test(parts[1])) return null;
    return parts[1].toLowerCase();
  } catch {
    return null;
  }
}

const handledUrls = new Set<string>();

/** Calls `open` for the launch link and later links, once per URL per session. */
export function subscribeToBarberProfileLinks(open: (barberId: string) => void): () => void {
  const handle = (url: string | null) => {
    if (!url || handledUrls.has(url)) return;
    const barberId = parseBarberProfileLink(url);
    if (!barberId) return;
    handledUrls.add(url);
    open(barberId);
  };
  void Linking.getInitialURL().then(handle);
  const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
  return () => subscription.remove();
}

/** Test-only: forget handled links between cases. */
export function resetHandledProfileLinks(): void {
  handledUrls.clear();
}
