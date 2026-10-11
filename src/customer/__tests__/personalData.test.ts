import { supabase } from '../../../lib/supabase';
import { listFavoriteBarberIds, saveAddress, setFavorite } from '../personalData';

jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;
type Builder = Record<'insert' | 'delete' | 'select' | 'eq' | 'order', jest.Mock> & { then: (resolve: (v: unknown) => void) => void };
function builder(result: unknown): Builder {
  const obj = {} as Builder;
  for (const key of ['insert', 'delete', 'select', 'eq', 'order'] as const) obj[key] = jest.fn(() => obj);
  obj.then = (resolve) => resolve(result);
  return obj;
}

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'me' } } } });
});

it('reads saved barber ids into a set', async () => {
  mockFrom.mockReturnValueOnce(builder({ data: [{ barber_id: 'b-1' }, { barber_id: 'b-2' }], error: null }));
  const result = await listFavoriteBarberIds();
  expect(result.status === 'ok' && [...result.ids]).toEqual(['b-1', 'b-2']);
});

it('saves and removes a favorite as the signed-in customer, treating a duplicate as saved', async () => {
  const add = builder({ error: { code: '23505', message: 'duplicate' } });
  mockFrom.mockReturnValueOnce(add);
  await expect(setFavorite('b-1', true)).resolves.toEqual({ status: 'ok' });
  expect(add.insert).toHaveBeenCalledWith({ customer_id: 'me', barber_id: 'b-1' });

  const remove = builder({ error: null });
  mockFrom.mockReturnValueOnce(remove);
  await expect(setFavorite('b-1', false)).resolves.toEqual({ status: 'ok' });
  expect(remove.eq).toHaveBeenCalledWith('customer_id', 'me');
});

it('maps the 10-address cap (PA002) to limit_reached', async () => {
  mockFrom.mockReturnValueOnce(builder({ error: { code: 'PA002', message: 'cap' } }));
  await expect(saveAddress('Home', 'Main Street 12, Berlin')).resolves.toEqual({ status: 'limit_reached' });
});
