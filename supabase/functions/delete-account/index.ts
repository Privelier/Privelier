// Account deletion with storage erasure (App Store 5.1.1(v), Google Play
// account deletion, GDPR Art. 17).
//
// SQL cannot remove Storage objects, and barbers have no DELETE policy on the
// private verification-docs bucket (their ID/licence files must stay intact
// while under review). So the trusted path is:
//   1. delete_own_account() runs AS THE CALLER (their JWT): it deletes only
//      auth.uid(), refuses with PA001 while bookings are live, and cascades
//      every public row in one transaction.
//   2. Only after that commits, the service role empties the caller's
//      folder (<uid>/...) in both buckets.
// If step 2 fails the account is still gone; the leftover objects sit under
// a uid with no auth.users row and are logged for a manual sweep.
//
// The service-role key exists only in this function's environment
// (SUPABASE_SERVICE_ROLE_KEY is injected by Supabase), never in the app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKETS = ['verification-docs', 'portfolio'] as const;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });
  const userId = userData.user.id;

  const { error: rpcError } = await asCaller.rpc('delete_own_account');
  if (rpcError) {
    if (rpcError.code === 'PA001') return json(409, { error: 'active_bookings' });
    console.error('delete_own_account failed', rpcError.code);
    return json(500, { error: 'delete_failed' });
  }

  const admin = createClient(url, serviceKey, {
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
