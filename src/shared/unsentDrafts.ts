/**
 * Unsent chat drafts, kept per room for the life of the app process so that
 * leaving a conversation mid-sentence does not lose the text. Memory only:
 * nothing is written to disk, and sign-out clears every draft so the next
 * account on the device never sees them.
 */
const drafts = new Map<string, string>();

export function getUnsentDraft(roomId: string): string {
  return drafts.get(roomId) ?? '';
}

export function setUnsentDraft(roomId: string, text: string): void {
  if (text.trim().length === 0) drafts.delete(roomId);
  else drafts.set(roomId, text);
}

export function clearUnsentDrafts(): void {
  drafts.clear();
}
