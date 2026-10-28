import { supabase } from '../../lib/supabase';

export interface ChatCounterpart {
  id: string;
  name: string;
  profile_image: string | null;
}

interface CounterpartRpcRow extends ChatCounterpart {
  booking_id: string;
}

/** Best-effort display identities from the participant-scoped 0012 RPC. */
export async function fetchBookingCounterparts(
  bookingIds: string[]
): Promise<Map<string, ChatCounterpart>> {
  const requestedIds = new Set(bookingIds.filter(Boolean));
  const counterparts = new Map<string, ChatCounterpart>();
  if (requestedIds.size === 0) return counterparts;

  try {
    const { data, error } = await supabase.rpc('get_booking_counterparts', {
      p_booking_ids: [...requestedIds],
    });
    if (error) return counterparts;

    for (const row of (data as CounterpartRpcRow[]) ?? []) {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!requestedIds.has(row.booking_id) || !row.id || !name) continue;
      counterparts.set(row.booking_id, {
        id: row.id,
        name,
        profile_image: typeof row.profile_image === 'string' ? row.profile_image : null,
      });
    }
  } catch {
    return counterparts;
  }

  return counterparts;
}

export async function fetchBookingCounterpart(
  bookingId: string
): Promise<ChatCounterpart | null> {
  return (await fetchBookingCounterparts([bookingId])).get(bookingId) ?? null;
}
