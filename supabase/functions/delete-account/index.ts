// Account deletion with storage erasure (App Store 5.1.1(v), Google Play
// account deletion, GDPR Art. 17).
//
// SQL cannot remove Storage objects, and barbers have no DELETE policy on the
// private verification-docs bucket (their ID/licence files must stay intact
// while under review). So the trusted path is:
//   1. delete_own_account() runs AS THE CALLER (their JWT): it deletes only
//      auth.uid(), cancels their upcoming bookings, keeps the other party's
//      history anonymized (migration 0057) and is rate limited per user.
//   2. Only after that commits, the secret key empties the caller's folder
//      (<uid>/...) in both buckets.
// If step 2 fails the account is still gone; the leftover objects sit under
// a uid with no auth.users row and are logged for a manual sweep.
// Repeating the call after success is harmless: step 1 is a no-op and the
// folders are already empty.
//
// Keys come from the function environment that Supabase injects, never from
// the app. SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS are JSON
// dictionaries (new API keys); the legacy single-key variables are read only
// until the project's legacy keys are disabled (docs/hardening/FOUNDER_ACTIONS.md).
// Deno resolves npm: specifiers at deploy time; Node's resolver cannot.
// eslint-disable-next-line import/no-unresolved
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKETS = ['verification-docs', 'portfolio'] as const;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function projectKey(dictionaryVar: string, legacyVar: string): string {
  const dictionary = Deno.env.get(dictionaryVar);
  if (dictionary) {
    const key = (JSON.parse(dictionary) as Record<string, string>).default;
    if (key) return key;
  }
  const legacy = Deno.env.get(legacyVar);
  if (!legacy) throw new Error(`${dictionaryVar} is not configured`);
  return legacy;
}

async function listOwnObjects(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<string[]> {
  const paths: string[] = [];
  // Objects are stored flat as <uid>/<file>; page through the folder.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 100, offset });
    if (error) throw error;
    for (const item of data ?? []) paths.push(`${userId}/${item.name}`);
    if (!data || data.length < 100) return paths;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'unauthorized' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, projectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });
  const userId = userData.user.id;

  const { error: rpcError } = await asCaller.rpc('delete_own_account');
  if (rpcError) {
    if (rpcError.code === 'PA429') return json(429, { error: 'rate_limited' });
    console.error('delete_own_account failed', rpcError.code);
    return json(500, { error: 'delete_failed' });
  }

  const admin = createClient(url, projectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const bucket of BUCKETS) {
    try {
      const paths = await listOwnObjects(admin, bucket, userId);
      if (paths.length > 0) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) throw error;
      }
    } catch (error) {
      // Never log object names: they can contain document descriptions.
      console.error(`storage cleanup failed bucket=${bucket} user=${userId}`, String(error));
    }
  }
  return json(200, { status: 'deleted' });
});
