import type { BookingRow } from '../types';

export type NotificationEventType = 'message' | 'new_request' | 'booking_status';
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

export function notificationCopy(row: NotificationRow, actorName: string | null): { title: string; body: string } {
  const name = actorName?.trim() || 'Someone';
  if (row.event_type === 'message') return { title: 'New message', body: `${name} sent you a message.` };
  if (row.event_type === 'new_request') return { title: 'New booking request', body: `${name} requested an appointment.` };
  switch (row.booking_status) {
    case 'accepted': return { title: 'Booking accepted', body: `${name} accepted the appointment.` };
    case 'rejected': return { title: 'Booking declined', body: `${name} declined the appointment.` };
    case 'cancelled': return { title: 'Booking cancelled', body: `${name} cancelled the appointment.` };
    case 'completed': return { title: 'Appointment complete', body: `${name} marked the appointment complete.` };
    default: return { title: 'Booking updated', body: `${name} updated the appointment.` };
  }
}
