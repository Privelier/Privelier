/**
 * Client configuration, validated once at startup. EXPO_PUBLIC_* values are
 * compiled into the app bundle in plain text, so only the project URL and
 * the publishable key may appear here. A secret key or a legacy
 * service_role key stops the app before it can be shipped.
 */
export interface ClientEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

function jwtRole(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export function readClientEnv(source: Record<string, string | undefined>): ClientEnv {
  const supabaseUrl = source.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey = source.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !/^https:\/\/[^\s/]+\/?$/.test(supabaseUrl)) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is missing or not an https URL. Copy .env.example to .env and fill it in.');
  }
  if (!supabasePublishableKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Use the publishable key from Supabase > Project Settings > API Keys ' +
        '(it replaces EXPO_PUBLIC_SUPABASE_ANON_KEY).'
    );
  }
  if (supabasePublishableKey.startsWith('sb_secret_') || jwtRole(supabasePublishableKey) === 'service_role') {
    throw new Error('A Supabase SECRET key is configured in the app. Remove it now and rotate it in the Supabase dashboard.');
  }
  return { supabaseUrl, supabasePublishableKey };
}
