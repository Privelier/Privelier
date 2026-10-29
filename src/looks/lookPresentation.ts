/**
 * Pure Looks rules for both apps: where a look stands, which styles may be
 * picked, when a look may be sent, and the hit-rate wording. The server
 * enforces every rule again; these only keep the UI honest and calm.
 */
import type { BarberLookStat, Look, LookStyle } from './types';

/** Mirrors private.looks_settings defaults (display only; the server decides). */
export const MAX_LOOK_PHOTOS = 3;
export const MAX_LOOK_STYLES = 3;
const LOOK_DRAFT_VALID_DAYS = 14;

export type LookStage =
  | 'none'
  | 'editing'
  | 'awaiting_customer'
  | 'expired'
  | 'confirmed'
  | 'published'
  | 'declined'
  | 'withdrawn';

const DAY_MS = 24 * 60 * 60 * 1000;

export function lookStage(look: Pick<Look, 'status' | 'submitted_at'> | null, now: Date = new Date()): LookStage {
  if (!look) return 'none';
  if (look.status !== 'draft') return look.status;
  if (!look.submitted_at) return 'editing';
  const sent = Date.parse(look.submitted_at);
  if (Number.isFinite(sent) && now.getTime() - sent > LOOK_DRAFT_VALID_DAYS * DAY_MS) return 'expired';
  return 'awaiting_customer';
}

/** Add or remove a style; never more than MAX_LOOK_STYLES. */
export function toggleStyle(selected: readonly string[], key: string): string[] {
  if (selected.includes(key)) return selected.filter((style) => style !== key);
  if (selected.length >= MAX_LOOK_STYLES) return [...selected];
  return [...selected, key];
}

export function canSendLook(input: { styles: readonly string[]; photoCount: number; noFace: boolean }): boolean {
  return (
    input.styles.length >= 1 &&
    input.styles.length <= MAX_LOOK_STYLES &&
    input.photoCount >= 1 &&
    input.photoCount <= MAX_LOOK_PHOTOS &&
    input.noFace
  );
}

function styleLabel(styles: readonly LookStyle[], key: string, de: boolean): string {
  const style = styles.find((s) => s.key === key);
  if (!style) return key;
  return de ? style.label_de : style.label_en;
}

export function styleList(styles: readonly LookStyle[], keys: readonly string[], de: boolean): string {
  return keys.map((key) => styleLabel(styles, key, de)).join(', ');
}

function percent(rate: number, de: boolean): string {
  const value = Math.round(rate * 100);
  return de ? `${value} %` : `${value}%`;
}

/** "Skin fade: 94% exact, 31 ratings", or an honest "not enough ratings yet". */
export function hitRateLine(stat: BarberLookStat, de: boolean): string {
  const label = de ? stat.label_de : stat.label_en;
  if (stat.hit_rate === null) {
    return de
      ? `${label}: noch zu wenige Bewertungen (${stat.feedback_count})`
      : `${label}: not enough ratings yet (${stat.feedback_count})`;
  }
  return de
    ? `${label}: ${percent(stat.hit_rate, de)} genau getroffen, ${stat.feedback_count} Bewertungen`
    : `${label}: ${percent(stat.hit_rate, de)} exact, ${stat.feedback_count} ratings`;
}

/** What the barber sees for a completed booking's look. */
export function barberLookStatus(stage: LookStage, de: boolean): { title: string; body: string } {
  switch (stage) {
    case 'none':
      return de
        ? { title: 'Ergebnis festhalten', body: 'Bis zu 3 Fotos von Hinterkopf und Seite, kein Gesicht. Der Kunde bestätigt.' }
        : { title: 'Capture the result', body: 'Up to 3 photos of the back and side, no face. The client confirms.' };
    case 'editing':
      return de
        ? { title: 'Entwurf gespeichert', body: 'Noch nicht an den Kunden gesendet.' }
        : { title: 'Draft saved', body: 'Not sent to the client yet.' };
    case 'awaiting_customer':
      return de
        ? { title: 'Wartet auf den Kunden', body: 'Der Kunde wurde gefragt, ob das sein Schnitt ist.' }
        : { title: 'Waiting for the client', body: 'The client was asked whether this is their cut.' };
    case 'expired':
      return de
        ? { title: 'Keine Antwort', body: 'Der Kunde hat nicht rechtzeitig geantwortet.' }
        : { title: 'No answer', body: 'The client did not answer in time.' };
    case 'confirmed':
      return de
        ? { title: 'Bestätigt', body: 'Zählt als Beweis, wird aber nicht gezeigt.' }
        : { title: 'Confirmed', body: 'Counts as proof but is not shown.' };
    case 'published':
      return de
        ? { title: 'Bestätigt und sichtbar', body: 'Zählt als Beweis und erscheint bei Kunden in deiner Stadt.' }
        : { title: 'Confirmed and shown', body: 'Counts as proof and appears to clients in your city.' };
    case 'declined':
      return de
        ? { title: 'Vom Kunden abgelehnt', body: 'Der Kunde sagt, das ist nicht sein Schnitt.' }
        : { title: 'Declined by the client', body: 'The client says this is not their cut.' };
    case 'withdrawn':
      return de
        ? { title: 'Zurückgezogen', body: 'Dieser Look zählt nicht mehr.' }
        : { title: 'Withdrawn', body: 'This look no longer counts.' };
  }
}
