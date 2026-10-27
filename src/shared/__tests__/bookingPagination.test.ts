import { BOOKINGS_PAGE_SIZE, buildBookingPage, isBookingCursor, olderThanFilter } from '../bookingPagination';
import type { BookingRow } from '../../types';

const row = (i: number): BookingRow => ({ id: `id-${i}`, date: '2026-10-01', time: '10:00:00' } as BookingRow);

describe('buildBookingPage', () => {
  it('reports no older page when the read fits', () => {
    const page = buildBookingPage([row(1), row(2)]);
    expect(page).toEqual({ bookings: [row(1), row(2)], hasOlder: false, olderCursor: null });
  });

  it('drops the probe row and points the cursor at the last kept row', () => {
    const rows = Array.from({ length: BOOKINGS_PAGE_SIZE + 1 }, (_, i) => row(i));
    const page = buildBookingPage(rows);
    expect(page.bookings).toHaveLength(BOOKINGS_PAGE_SIZE);
    expect(page.hasOlder).toBe(true);
    expect(page.olderCursor).toEqual({ date: '2026-10-01', time: '10:00:00', id: `id-${BOOKINGS_PAGE_SIZE - 1}` });
  });
});

describe('isBookingCursor', () => {
  it('accepts row-shaped cursors only', () => {
    expect(isBookingCursor({ date: '2026-10-01', time: '10:00', id: 'a1-b2' })).toBe(true);
    expect(isBookingCursor({ date: '2026-10-01', time: '10:00:00', id: 'x,id.gt.0' })).toBe(false);
    expect(isBookingCursor({ date: '01.10.2026', time: '10:00', id: 'a' })).toBe(false);
    expect(isBookingCursor(null)).toBe(false);
  });
});

describe('olderThanFilter', () => {
  it('orders by date, then time, then id', () => {
    expect(olderThanFilter({ date: '2026-10-01', time: '10:00:00', id: 'abc' })).toBe(
      'date.lt.2026-10-01,and(date.eq.2026-10-01,time.lt.10:00:00),and(date.eq.2026-10-01,time.eq.10:00:00,id.lt.abc)'
    );
  });
});
