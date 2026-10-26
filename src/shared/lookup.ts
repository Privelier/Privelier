/**
 * Map lookup for ids that may be null: a booking, message or review keeps
 * its row after the other person deletes their account, with their id set
 * to null (migration 0057). A null id simply has no entry.
 */
export function byId<T>(map: ReadonlyMap<string, T>, id: string | null | undefined): T | undefined {
  return id ? map.get(id) : undefined;
}
