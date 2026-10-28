import type { BookingRow } from '../types';
import { getAppLanguage } from './locale';

export type NotificationEventType =
  | 'message'
  | 'new_request'
  | 'booking_status'
  | 'trip_started'
  | 'trip_arriving'
  | 'trip_arrived'
  | 'look_confirm';
export type NotificationChannelKind = 'notification-badge' | 'notifications';

let notificationChannelSequence = 0;

export function notificationChannelTopic(kind: NotificationChannelKind, recipientId: string): string {
  return `${kind}:${recipientId}:${Date.now()}:${++notificationChannelSequence}`;
}
export function formatNotificationBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

export interface NotificationRow {
  id: string;
  recipient_id: string;
  event_type: NotificationEventType;
  booking_id: string;
  message_id: string | null;
  /** null when the change was made by Privelier itself (no user session). */
  actor_id: string | null;
  booking_status: BookingRow['status'] | null;
  event_key: string;
  created_at: string;
  read_at: string | null;
}

export function notificationCopy(
  row: NotificationRow,
  actorName: string | null,
  language = getAppLanguage()
): { title: string; body: string } {
  const isGerman = language === 'de';
  const name = row.actor_id === null
    ? 'Privelier'
    : actorName?.trim() || (isGerman ? 'Jemand' : 'Someone');
  if (row.event_type === 'message') {
    return isGerman
      ? { title: 'Neue Nachricht', body: `${name} hat dir eine Nachricht geschickt.` }
      : { title: 'New message', body: `${name} sent you a message.` };
  }
  // Trip events mirror notification_push_copy() in migration 0049.
  if (row.event_type === 'trip_started') {
    return isGerman
      ? { title: 'Dein Barber ist unterwegs', body: `${name} ist auf dem Weg zu dir. Verfolge die Ankunft live.` }
      : { title: 'Your barber is on the way', body: `${name} is on the way to you. Follow the arrival live.` };
  }
  if (row.event_type === 'trip_arriving') {
    return isGerman
      ? { title: 'Gleich da', body: `${name} ist in wenigen Minuten bei dir.` }
      : { title: 'Almost there', body: `${name} will be with you in a few minutes.` };
  }
  if (row.event_type === 'trip_arrived') {
    return isGerman
      ? { title: 'Dein Barber ist da', body: `${name} ist an deiner Adresse angekommen.` }
      : { title: 'Your barber has arrived', body: `${name} has arrived at your address.` };
  }
  // Looks (migration 0064): the barber captured the client's result.
  if (row.event_type === 'look_confirm') {
    return isGerman
      ? { title: 'Ist das dein Schnitt?', body: `${name} hat das Ergebnis deines Termins festgehalten. Bestätige es oder lehne ab.` }
      : { title: 'Is this your cut?', body: `${name} captured the result of your appointment. Confirm it or decline.` };
  }
  if (row.event_type === 'new_request') {
    return isGerman
      ? { title: 'Neue Terminanfrage', body: `${name} hat einen Termin angefragt.` }
      : { title: 'New booking request', body: `${name} requested an appointment.` };
  }
  switch (row.booking_status) {
    case 'accepted': return isGerman
      ? { title: 'Termin bestätigt', body: `${name} hat den Termin bestätigt.` }
      : { title: 'Booking accepted', body: `${name} accepted the appointment.` };
    case 'rejected': return isGerman
      ? { title: 'Terminanfrage abgelehnt', body: `${name} hat den Termin abgelehnt.` }
      : { title: 'Booking declined', body: `${name} declined the appointment.` };
    case 'cancelled': return isGerman
      ? { title: 'Termin abgesagt', body: `${name} hat den Termin abgesagt.` }
      : { title: 'Booking cancelled', body: `${name} cancelled the appointment.` };
    case 'completed': return isGerman
      ? { title: 'Termin abgeschlossen', body: `${name} hat den Termin abgeschlossen.` }
      : { title: 'Appointment complete', body: `${name} marked the appointment complete.` };
    default: return isGerman
      ? { title: 'Termin aktualisiert', body: `${name} hat den Termin aktualisiert.` }
      : { title: 'Booking updated', body: `${name} updated the appointment.` };
  }
}
