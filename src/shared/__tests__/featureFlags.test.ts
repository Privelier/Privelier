import { renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '../../../lib/supabase';
import { loadFeatureFlags, resetFeatureFlagCache, useFeatureFlag } from '../featureFlags';

jest.mock('../devLog', () => ({ devWarn: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    rpc: jest.fn(),
  },
}));

const mockRpc = supabase.rpc as jest.Mock;
const mockSession = supabase.auth.getSession as jest.Mock;

function signedInAs(id: string | null) {
  mockSession.mockResolvedValue({ data: { session: id ? { user: { id } } : null } });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetFeatureFlagCache();
  signedInAs('me');
});

describe('loadFeatureFlags', () => {
  it('returns the enabled keys from my_feature_flags', async () => {
    mockRpc.mockResolvedValueOnce({ data: ['looks'], error: null });
    await expect(loadFeatureFlags()).resolves.toEqual(new Set(['looks']));
    expect(mockRpc).toHaveBeenCalledWith('my_feature_flags', undefined);
  });

  it('is off when the function does not exist yet (migration not applied)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    await expect(loadFeatureFlags()).resolves.toEqual(new Set());
  });

  it('is off when the call throws', async () => {
    mockRpc.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(loadFeatureFlags()).resolves.toEqual(new Set());
  });

  it('is off for a malformed payload and ignores non-string keys', async () => {
    mockRpc.mockResolvedValueOnce({ data: { looks: true }, error: null });
    await expect(loadFeatureFlags()).resolves.toEqual(new Set());
    resetFeatureFlagCache();
    mockRpc.mockResolvedValueOnce({ data: ['looks', 7, null], error: null });
    await expect(loadFeatureFlags()).resolves.toEqual(new Set(['looks']));
  });

  it('is off without a session and never calls the server', async () => {
    signedInAs(null);
    await expect(loadFeatureFlags()).resolves.toEqual(new Set());
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('caches a successful lookup per user but retries after a failure', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'boom' } });
    await loadFeatureFlags();
    mockRpc.mockResolvedValueOnce({ data: ['looks'], error: null });
    await expect(loadFeatureFlags()).resolves.toEqual(new Set(['looks']));
    await loadFeatureFlags();
    expect(mockRpc).toHaveBeenCalledTimes(2);

    signedInAs('someone-else');
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(loadFeatureFlags()).resolves.toEqual(new Set());
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });
});

describe('useFeatureFlag', () => {
  it('is off while the lookup is still in flight', async () => {
    mockRpc.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await renderHook(() => useFeatureFlag('looks'));
    expect(result.current).toBe(false);
  });

  it('turns on only when the key is present', async () => {
    mockRpc.mockResolvedValueOnce({ data: ['looks'], error: null });
    const { result } = await renderHook(() => useFeatureFlag('looks'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays off when the flag is absent', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = await renderHook(() => useFeatureFlag('looks'));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
