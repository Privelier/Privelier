import { bookingHint, timelineSteps } from '../BookingDetails';

jest.mock('../GlassSurface', () => ({ GlassSurface: () => null }));
jest.mock('../StatusPill', () => ({ StatusPill: () => null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

describe('bookingHint', () => {
  it('never tells a barber to wait for "your barber"', () => {
    expect(bookingHint('pending', 'barber', false)).toBe('Accept or decline this request.');
    expect(bookingHint('accepted', 'barber', false)).toBe('The customer pays you directly.');
    expect(bookingHint('pending', 'barber', false)).not.toMatch(/your barber/i);
  });

  it('keeps the customer copy and the shared terminal copy', () => {
    expect(bookingHint('pending', 'customer', false)).toBe('Your barber still needs to accept this request.');
    expect(bookingHint('completed', 'customer', false)).toBe('Pay your barber directly.');
    expect(bookingHint('rejected', 'barber', false)).toBe('This appointment will not take place.');
    expect(bookingHint('cancelled', 'customer', true)).toBe('Dieser Termin findet nicht statt.');
  });
});

describe('timelineSteps', () => {
  const summary = (status: Parameters<typeof timelineSteps>[0], role: 'customer' | 'barber' = 'customer') =>
    timelineSteps(status, role, false).map((s) => `${s.label}:${s.state}`);

  it('derives live steps from status alone', () => {
    expect(summary('pending')).toEqual(['Requested:done', 'Accepted:current', 'Completed:upcoming']);
    expect(summary('pending', 'barber')).toEqual(['Requested:done', 'Your answer:current', 'Completed:upcoming']);
    expect(summary('accepted')).toEqual(['Requested:done', 'Accepted:done', 'Completed:upcoming']);
    expect(summary('completed')).toEqual(['Requested:done', 'Accepted:done', 'Completed:done']);
  });

  it('never implies a cancelled booking had been accepted', () => {
    expect(summary('cancelled')).toEqual(['Requested:done', 'Cancelled:stopped']);
    expect(summary('rejected')).toEqual(['Requested:done', 'Declined:stopped']);
  });
});
