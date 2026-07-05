/**
 * Table-driven tests for the customer discovery error mapping layer
 * (src/customer/errors.ts). Mirrors src/barber/__tests__/errors.test.ts in
 * style: covers every branch of mapPostgrestError, plus the brand-voice rule
 * that customerDataErrorCopy is calm sentence case with no exclamation marks.
 */
import {
  customerDataErrorCopy,
  failure,
  mapPostgrestError,
  type CustomerDataErrorCode,
} from '../errors';

describe('customerDataErrorCopy (brand voice)', () => {
  it('has no exclamation marks and is sentence case for every code', () => {
    Object.entries(customerDataErrorCopy).forEach(([code, copy]) => {
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
      message: customerDataErrorCopy.network,
      retryable: true,
    });
  });

  it.each<[CustomerDataErrorCode, boolean]>([
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
      mapPostgrestError('ctx', { code: '42501', message: 'permission denied for table users' })
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
        message: 'new row for relation "services" violates check constraint "services_price_check"',
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
});
