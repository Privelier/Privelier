/**
 * Unit tests for the barber's time-zone sync (src/barber/profileData.ts,
 * migration 0069). The Supabase client is mocked; nothing touches a network.
 */
import { supabase } from '../../../lib/supabase';
import { deviceTimeZone, syncOwnTimeZone } from '../profileData';

jest.mock('../../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;

function updateBuilder(error: unknown = null) {
  const eq = jest.fn(() => Promise.resolve({ error }));
  const update = jest.fn(() => ({ eq }));
  mockFrom.mockReturnValueOnce({ update });
  return { update, eq };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('syncOwnTimeZone', () => {
  it('writes the device zone when it differs from the stored one', async () => {
    const zone = deviceTimeZone();
    expect(zone).toEqual(expect.any(String));
    const { update, eq } = updateBuilder();

    await syncOwnTimeZone('barber-1', 'Pacific/Kiritimati');

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(update).toHaveBeenCalledWith({ time_zone: zone });
    expect(eq).toHaveBeenCalledWith('id', 'barber-1');
  });

  it('does nothing when the stored zone already matches', async () => {
    await syncOwnTimeZone('barber-1', deviceTimeZone());

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('swallows a failed write (best-effort, retried on the next load)', async () => {
    updateBuilder({ code: '22023', message: 'unknown time zone' });

    await expect(syncOwnTimeZone('barber-1', null)).resolves.toBeUndefined();
  });
});
