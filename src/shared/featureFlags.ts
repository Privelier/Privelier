/**
 * Feature flags (migration 0062, Looks slice S1).
 *
 * New features ship dark. The app asks public.my_feature_flags() for the
 * signed-in user's enabled keys and treats EVERYTHING else as off: a missing
 * function (migration not applied), any error, a malformed payload, no
 * session, or a key that is simply absent. The server checks the same flag
 * in every gated function and policy, so "off" here is never the only guard.
 *
 * Successful lookups are cached per user for the app session; a failed
 * lookup is not cached, so the next screen focus asks again.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { devWarn } from './devLog';

export type FeatureFlagKey = 'looks';

const NONE: ReadonlySet<string> = new Set();

let cache: { userId: string; flags: Promise<ReadonlySet<string> | null> } | null = null;

/** The caller's enabled flags, or null when they could not be read. */
async function fetchFlags(): Promise<ReadonlySet<string> | null> {
  try {
    const { data, error } = await supabase.rpc('my_feature_flags');
    if (error) {
      devWarn('[flags] my_feature_flags', error);
      return null;
    }
    if (!Array.isArray(data)) return NONE;
    return new Set(data.filter((key): key is string => typeof key === 'string'));
  } catch (err) {
    devWarn('[flags] my_feature_flags', err);
    return null;
  }
}

export async function loadFeatureFlags(): Promise<ReadonlySet<string>> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return NONE;
  if (cache?.userId !== userId) cache = { userId, flags: fetchFlags() };
  const current = cache;
  const flags = await current.flags;
  if (flags === null) {
    if (cache === current) cache = null;
    return NONE;
  }
  return flags;
}

/** Test seam: forget cached flags (sign-out also changes the user id). */
export function resetFeatureFlagCache(): void {
  cache = null;
}

/** Whether `key` is on for the signed-in user. Off until proven on. */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    void loadFeatureFlags()
      .then((flags) => {
        if (active) setEnabled(flags.has(key));
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [key]);
  return enabled;
}
