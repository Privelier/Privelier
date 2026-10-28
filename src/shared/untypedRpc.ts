/**
 * RPC access for database functions that are not yet in the generated
 * schema types.
 *
 * src/database.types.ts is generated from the LIVE database (`npm run
 * db:types`). The Looks migrations (0062 onwards) exist only as files until
 * a founder applies them, so their functions are unknown to the typed
 * client. Callers name the expected row type themselves and must treat the
 * payload as untrusted (validate its shape before use). Once the migrations
 * are applied and the types regenerated, switch callers back to
 * `supabase.rpc` and delete this module.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { PostgrestErrorLike } from './dataErrors';

export interface UntypedRpcResult<T> {
  data: T | null;
  error: PostgrestErrorLike | null;
}

const client = supabase as unknown as SupabaseClient;

export async function untypedRpc<T>(fn: string, args?: Record<string, unknown>): Promise<UntypedRpcResult<T>> {
  const { data, error } = await client.rpc(fn, args);
  return { data: (data as T | null) ?? null, error: error ?? null };
}

/** A table read for a table that is not in the generated types yet. */
export function untypedTable(table: string) {
  return client.from(table);
}
