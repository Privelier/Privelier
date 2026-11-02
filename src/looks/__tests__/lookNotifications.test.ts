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

describe('wish notification copy (mirrors notification_push_copy in 0067)', () => {
  const wish: NotificationRow = { ...row, event_type: 'look_wish', booking_id: null, look_wish_id: 'w-1', actor_id: null, event_key: 'wish:w-1:x' };

  it('tells the barber about a wish without naming the client', () => {
    expect(notificationCopy(wish, null, 'en')).toEqual({
      title: 'A look wish in your city',
      body: 'A client wants a look you have proven. Suggest a time.',
    });
    expect(notificationCopy(wish, null, 'de')).toEqual({
      title: 'Look-Wunsch in deiner Stadt',
      body: 'Ein Kunde sucht einen Look, den du nachweislich schneidest. Schlag eine Zeit vor.',
    });
  });

  it('names the barber who offered a time', () => {
    const offer: NotificationRow = { ...wish, event_type: 'look_offer', actor_id: 'barber', event_key: 'offer:o-1' };
    expect(notificationCopy(offer, 'Marco', 'en')).toEqual({ title: 'New offer for your look', body: 'Marco suggested a time for your look wish.' });
    expect(notificationCopy(offer, 'Marco', 'de')).toEqual({ title: 'Neues Angebot für deinen Look', body: 'Marco hat dir eine Zeit für deinen Look-Wunsch vorgeschlagen.' });
  });
});
