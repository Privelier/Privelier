import { notificationCopy, type NotificationRow } from '../../shared/notifications';

const row: NotificationRow = {
  id: 'n-1', recipient_id: 'customer', event_type: 'look_confirm', booking_id: 'b-1', message_id: null,
  actor_id: 'barber', booking_status: null, event_key: 'look:l-1:confirm', created_at: '2026-10-28T10:00:00Z', read_at: null,
};

describe('look_confirm notification copy (mirrors notification_push_copy in 0064)', () => {
  it('asks the question and names only the barber', () => {
    expect(notificationCopy(row, 'Marco', 'en')).toEqual({
      title: 'Is this your cut?',
      body: 'Marco captured the result of your appointment. Confirm it or decline.',
    });
    expect(notificationCopy(row, 'Marco', 'de')).toEqual({
      title: 'Ist das dein Schnitt?',
      body: 'Marco hat das Ergebnis deines Termins festgehalten. Bestätige es oder lehne ab.',
    });
  });

  it('falls back to a neutral name', () => {
    expect(notificationCopy(row, null, 'en').body.startsWith('Someone ')).toBe(true);
  });
});
