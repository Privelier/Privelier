import { supabase } from '../../../lib/supabase';
import { updateOwnProfile } from '../profileData';

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function updateChain(result: unknown) {
  const builder: {
    update: jest.Mock;
    eq: jest.Mock;
    select: jest.Mock;
    single: jest.Mock;
  } = {
    update: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    select: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
  };
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateOwnProfile', () => {
  it('updates the signed-in user with trimmed profile location fields', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'customer-1' } }, error: null });
    const profile = { id: 'customer-1', name: 'Alex Morgan', city: 'Nuremberg', country: 'Germany' };
    const builder = updateChain({ data: profile, error: null });
    mockFrom.mockReturnValue(builder);

    await expect(updateOwnProfile({ name: '  Alex Morgan  ', city: '  Nuremberg  ', country: '  Germany  ' })).resolves.toEqual({
      status: 'ok',
      profile,
    });
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(builder.update).toHaveBeenCalledWith({ name: 'Alex Morgan', city: 'Nuremberg', country: 'Germany' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'customer-1');
  });

  it('rejects an invalid name before reading or writing a profile', async () => {
    await expect(updateOwnProfile({ name: ' ', city: 'Nuremberg' })).resolves.toMatchObject({
      status: 'error',
      code: 'invalid_input',
    });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('stores a blank optional country as null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'customer-1' } }, error: null });
    const profile = { id: 'customer-1', name: 'Alex Morgan', city: 'Eckental', country: null };
    const builder = updateChain({ data: profile, error: null });
    mockFrom.mockReturnValue(builder);

    await expect(updateOwnProfile({ name: 'Alex Morgan', city: 'Eckental', country: '  ' })).resolves.toEqual({
      status: 'ok',
      profile,
    });
    expect(builder.update).toHaveBeenCalledWith({ name: 'Alex Morgan', city: 'Eckental', country: null });
  });
});
