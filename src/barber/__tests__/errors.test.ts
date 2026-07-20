/**
 * Table-driven tests for the barber services/availability error mapping
 * layer (src/barber/errors.ts). Mirrors src/auth/__tests__/errors.test.ts in
 * style: covers every branch of mapPostgrestError, plus the brand-voice rule
 * that barberDataErrorCopy is calm sentence case with no exclamation marks.
 */
import {
  barberDataErrorCopy,
  failure,
  mapPostgrestError,
  type BarberDataErrorCode,
} from '../errors';

describe('barberDataErrorCopy (brand voice)', () => {
  it('has no exclamation marks and is sentence case for every code', () => {
    Object.entries(barberDataErrorCopy).forEach(([code, copy]) => {
      expect(copy).not.toMatch(/!/);
      // Sentence case: starts with an uppercase letter, not ALL CAPS.
      expect(copy[0]).toMatch(/[A-Z]/);
      expect(copy).not.toMatch(/^[A-Z\s]+$/); // not all-caps
    });
  });
});

describe('failure()', () => {
  it('builds a typed failure with the matching copy and retryable flag', () => {
    const result = failure('network');
    expect(result).toEqual({
      status: 'error',
      code: 'network',
      message: barberDataErrorCopy.network,
      retryable: true,
    });
  });

  it.each<[BarberDataErrorCode, boolean]>([
    ['network', true],
    ['forbidden', false],
    ['invalid_input', false],
    ['unknown', false],
  ])('retryable set is correct for %s', (code, retryable) => {
    expect(failure(code).retryable).toBe(retryable);
  });
});

describe('mapPostgrestError', () => {
  it('maps 42501 (RLS denial) to forbidden', () => {
    expect(
      mapPostgrestError('ctx', { code: '42501', message: 'permission denied for table services' })
    ).toEqual(failure('forbidden'));
  });

  it('maps a row-level-security message with no code to forbidden', () => {
    expect(
      mapPostgrestError('ctx', { message: 'new row violates row-level security policy' })
    ).toEqual(failure('forbidden'));
  });

  it('maps 23514 (check violation) to invalid_input', () => {
    expect(
      mapPostgrestError('ctx', {
        code: '23514',
        message: 'new row for relation "availability" violates check constraint "chk_availability_time_order"',
      })
    ).toEqual(failure('invalid_input'));
  });

  it.each(['network request failed', 'failed to fetch'])(
    'maps a network-ish message %s to network',
    (message) => {
      expect(mapPostgrestError('ctx', { message })).toEqual(failure('network'));
    }
  );

  it('falls back to unknown for an unrecognised Postgres error', () => {
    expect(mapPostgrestError('ctx', { code: '23505', message: 'duplicate key value' })).toEqual(
      failure('unknown')
    );
  });

  it('falls back to unknown when raw is null', () => {
    expect(mapPostgrestError('ctx', null)).toEqual(failure('unknown'));
  });

  it('falls back to unknown when raw has no code or message', () => {
    expect(mapPostgrestError('ctx', {})).toEqual(failure('unknown'));
  });

  // Copy overrides (finding L1): a caller may replace the SENTENCE for a code
  // whose default copy was written for another surface. The code, retryable
  // flag, and every non-overridden code must be untouched.
  describe('copy overrides', () => {
    it('replaces only the overridden code’s message, never the code itself', () => {
      const result = mapPostgrestError('ctx', { code: '23514' }, { invalid_input: 'Bio too long.' });
      expect(result.code).toBe('invalid_input');
      expect(result.message).toBe('Bio too long.');
      expect(result.retryable).toBe(false);
    });

    it('leaves codes the caller did not override on the default copy', () => {
      const result = mapPostgrestError('ctx', { code: '42501' }, { invalid_input: 'Bio too long.' });
      expect(result).toEqual(failure('forbidden'));
    });

    it('keeps network retryable when its copy is overridden', () => {
      const result = failure('network', { network: 'No connection.' });
      expect(result).toEqual({
        status: 'error',
        code: 'network',
        message: 'No connection.',
        retryable: true,
      });
    });
  });
});
