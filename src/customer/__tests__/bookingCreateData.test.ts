/**
 * Unit/integration tests for booking creation
 * (src/customer/bookingCreateData.ts, build-order step 11-12). The Supabase
 * client (`lib/supabase.ts`) is mocked entirely, matching the mocking
 * approach in src/auth/__tests__/authService.test.ts (auth.getUser +
 * from(...) both mocked) and the `chainable` helper used across the
 * customer/barber data-layer tests — these tests never touch a real network
 * or database.
 *
 * insertBooking's 23505 handling is deliberately its OWN local branch (see
 * the module's header comment and src/customer/errors.ts's UNIQUE_VIOLATION
 * export) rather than going through the shared "23505-as-idempotent-success"
 * pattern used for auth provisioning retries (src/auth/authService.ts) — a
 * booking-slot race is a real, user-facing conflict between two different
 * actors, not the same actor's own retried request racing itself. These
 * tests confirm the two stay distinct.
 */
import { supabase } from '../../../lib/supabase';
import { insertBooking } from '../bookingCreateData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// Mirrors the `chainable` helper used across the other customer/barber data
// layer tests, extended with `insert` for this module's write path.
function chainable(result: unknown) {
  const obj: {
    insert: jest.Mock;
    select: jest.Mock;
    single: jest.Mock;
  } = {
    insert: jest.fn(() => obj),
    select: jest.fn(() => obj),
    single: jest.fn(() => Promise.resolve(result)),
  };
  return obj;
}

const VALID_INPUT = {
  barberId: 'b-1',
  serviceId: 's-1',
  date: '2026-07-13',
  time: '09:00:00',
  location: '123 Example Street',
};

describe('insertBooking', () => {
  describe('success path', () => {
    it('reads customer_id from the session (not the caller) and omits price/status from the insert payload', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'customer-1' } }, error: null });
      const created = {
        id: 'booking-1',
        customer_id: 'customer-1',
        barber_id: 'b-1',
        service_id: 's-1',
        date: '2026-07-13',
        time: '09:00:00',
        location: '123 Example Street',
        price: 25,
        status: 'pending',
        created_at: '2026-07-01T00:00:00Z',
      };
      const builder = chainable({ data: created, error: null });
      mockFrom.mockReturnValueOnce(builder);

      const result = await insertBooking(VALID_INPUT);

      expect(result).toEqual({ status: 'ok', booking: created });
      expect(mockFrom).toHaveBeenCalledWith('bookings');
      expect(builder.insert).toHaveBeenCalledWith({
        customer_id: 'customer-1',
        barber_id: 'b-1',
        service_id: 's-1',
        date: '2026-07-13',
        time: '09:00:00',
        location: '123 Example Street',
      });
      // Explicitly confirm no `price` or `status` key made it into the
      // payload at all — both are server-owned (trigger-stamped price,
      // RLS/column-default status).
      const payload = builder.insert.mock.calls[0][0];
      expect(payload).not.toHaveProperty('price');
      expect(payload).not.toHaveProperty('status');
    });

    it('trims the location before inserting', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'customer-1' } }, error: null });
      const builder = chainable({ data: { id: 'booking-1' }, error: null });
      mockFrom.mockReturnValueOnce(builder);

      await insertBooking({ ...VALID_INPUT, location: '  123 Example Street  ' });

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ location: '123 Example Street' })
      );
    });
  });

  describe('conflict mapping (23505 on uq_bookings_barber_slot_active)', () => {
    it('maps a 23505 unique-violation to a conflict result, distinct from the generic error shape', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'customer-1' } }, error: null });
      const builder = chainable({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "uq_bookings_barber_slot_active"',
        },
      });
      mockFrom.mockReturnValueOnce(builder);

      const result = await insertBooking(VALID_INPUT);

      expect(result).toEqual({ status: 'conflict' });
      // Distinct from a generic CustomerDataFailure: no `code`/`message`/
      // `retryable` fields, just the bare conflict discriminant.
      expect(result).not.toHaveProperty('code');
      expect(result).not.toHaveProperty('message');
    });

    it('does NOT apply the auth-provisioning "23505-as-idempotent-success" pattern — a slot conflict is never silently treated as success', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'customer-1' } }, error: null });
      const builder = chainable({
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      });
      mockFrom.mockReturnValueOnce(builder);

      const result = await insertBooking(VALID_INPUT);

      expect(result.status).toBe('conflict');
      expect(result.status).not.toBe('ok');
    });
  });

  describe('empty/missing-session handling', () => {
    it('returns invalid_input without ever calling getUser when location is empty', async () => {
      const result = await insertBooking({ ...VALID_INPUT, location: '   ' });

      expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns forbidden when there is no signed-in user, without inserting', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const result = await insertBooking(VALID_INPUT);

      expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns unknown when getUser itself errors, without inserting', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'network request failed' },
      });

      const result = await insertBooking(VALID_INPUT);

      expect(result).toMatchObject({ status: 'error', code: 'unknown' });
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('generic Postgrest error mapping', () => {
    it('maps an RLS denial (42501) to forbidden via the shared mapPostgrestError', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'customer-1' } }, error: null });
      const builder = chainable({
        data: null,
        error: { code: '42501', message: 'permission denied for table bookings' },
      });
      mockFrom.mockReturnValueOnce(builder);

      const result = await insertBooking(VALID_INPUT);
      expect(result).toMatchObject({ status: 'error', code: 'forbidden' });
    });

    it('maps a CHECK violation (23514) to invalid_input via the shared mapPostgrestError', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'customer-1' } }, error: null });
      const builder = chainable({
        data: null,
        error: { code: '23514', message: 'violates check constraint "bookings_price_check"' },
      });
      mockFrom.mockReturnValueOnce(builder);

      const result = await insertBooking(VALID_INPUT);
      expect(result).toMatchObject({ status: 'error', code: 'invalid_input' });
    });

    it('falls back to unknown for an unrecognised error code', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'customer-1' } }, error: null });
      const builder = chainable({
        data: null,
        error: { code: '99999', message: 'something unexpected' },
      });
      mockFrom.mockReturnValueOnce(builder);

      const result = await insertBooking(VALID_INPUT);
      expect(result).toMatchObject({ status: 'error', code: 'unknown' });
    });
  });
});
