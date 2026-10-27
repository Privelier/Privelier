import { buildFailure, classifyPostgrestError, isNetworkMessage, UNIQUE_VIOLATION } from '../dataErrors';
import { getAppLanguage } from '../locale';

jest.mock('../locale', () => ({ getAppLanguage: jest.fn(() => 'en') }));
const mockLanguage = getAppLanguage as jest.Mock;

describe('classifyPostgrestError', () => {
  it('maps Postgres and abuse-limit codes', () => {
    expect(classifyPostgrestError({ code: '42501' })).toBe('forbidden');
    expect(classifyPostgrestError({ code: '23514' })).toBe('invalid_input');
    expect(classifyPostgrestError({ code: 'P0001' })).toBe('transition_rejected');
    expect(classifyPostgrestError({ code: 'PA429' })).toBe('rate_limited');
    expect(classifyPostgrestError({ code: 'PA030' })).toBe('blocked_language');
    expect(classifyPostgrestError({ code: 'PA002' })).toBe('limit_reached');
  });

  it('falls back to the message, then unknown', () => {
    expect(classifyPostgrestError({ message: 'new row violates row-level security policy' })).toBe('forbidden');
    expect(classifyPostgrestError({ message: 'TypeError: Network request failed' })).toBe('network');
    expect(classifyPostgrestError({ code: 'XX000', message: 'boom' })).toBe('unknown');
    expect(classifyPostgrestError(null)).toBe('unknown');
  });

  it('leaves unique violations to the caller', () => {
    expect(classifyPostgrestError({ code: UNIQUE_VIOLATION })).toBe('unknown');
  });
});

describe('isNetworkMessage', () => {
  it('recognises fetch-level failures only', () => {
    expect(isNetworkMessage('Failed to fetch')).toBe(true);
    expect(isNetworkMessage('permission denied')).toBe(false);
    expect(isNetworkMessage(null)).toBe(false);
  });
});

describe('buildFailure', () => {
  const copy = { en: { network: 'Offline', unknown: 'Oops' }, de: { network: 'Offline (de)', unknown: 'Hoppla' } };
  afterEach(() => mockLanguage.mockReturnValue('en'));

  it('uses the app language, and only network is retryable', () => {
    expect(buildFailure('network', copy)).toEqual({ status: 'error', code: 'network', message: 'Offline', retryable: true });
    mockLanguage.mockReturnValue('de');
    expect(buildFailure('unknown', copy)).toEqual({ status: 'error', code: 'unknown', message: 'Hoppla', retryable: false });
  });

  it('prefers caller copy', () => {
    expect(buildFailure('unknown', copy, 'Custom').message).toBe('Custom');
  });
});
