import { notificationCopy, type NotificationRow } from '../notifications';

const notification = (event_type: NotificationRow['event_type'], booking_status: NotificationRow['booking_status'] = null): NotificationRow => ({
  id: 'notification-1', recipient_id: 'recipient-1', event_type,
  booking_id: 'booking-1', message_id: event_type === 'message' ? 'message-1' : null,
  actor_id: 'actor-1', booking_status, event_key: 'event-1',
  created_at: '2026-09-26T12:00:00.000Z', read_at: null,
});

describe('notificationCopy', () => {
  it('describes new messages and requests without exposing message text', () => {
    expect(notificationCopy(notification('message'), 'Taha')).toEqual({ title: 'New message', body: 'Taha sent you a message.' });
    expect(notificationCopy(notification('new_request'), null)).toEqual({ title: 'New booking request', body: 'Someone requested an appointment.' });
  });

  it.each(['accepted', 'rejected', 'cancelled', 'completed'] as const)('describes %s booking updates', (status) => {
    expect(notificationCopy(notification('booking_status', status), 'Taha').body).toContain('Taha');
  });
});
