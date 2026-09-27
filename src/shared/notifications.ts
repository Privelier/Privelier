import type { BookingRow } from '../types';
import { getAppLanguage } from './locale';

export type NotificationEventType = 'message' | 'new_request' | 'booking_status';
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
  actor_id: string;
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
  const name = actorName?.trim() || (isGerman ? 'Jemand' : 'Someone');
  if (row.event_type === 'message') {
    return isGerman
      ? { title: 'Neue Nachricht', body: `${name} hat dir eine Nachricht geschickt.` }
      : { title: 'New message', body: `${name} sent you a message.` };
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
