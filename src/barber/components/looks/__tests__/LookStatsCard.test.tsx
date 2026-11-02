/**
 * LookStatsCard (Looks, Studio): the barber's own proof per style, the
 * exact-hit rate once revealed, a nudge while nothing is proven, and
 * nothing at all when the stats could not load. RNTL v14 render() is async.
 */
import { render, screen } from '@testing-library/react-native';
import { LookStatsCard } from '../LookStatsCard';
import { fetchBarberLookStats } from '../../../../looks/looksData';

jest.mock('../../../../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'x' } } } })) } },
}));
jest.mock('../../../../looks/looksData', () => ({ fetchBarberLookStats: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { border: '#2A2A2E', surface: '#1B1B1E', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accentText: '#BFA06B' },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));

const stat = (style: string, hit_rate: number | null) => ({
  style, label_en: style === 'taper' ? 'Taper' : 'Crop', label_de: style === 'taper' ? 'Taper' : 'Crop',
  feedback_count: 12, exact_count: 11, close_count: 1, hit_rate, proof_count: 7,
});

beforeEach(() => jest.clearAllMocks());

it('shows proof per style and the rate once enough clients rated', async () => {
  (fetchBarberLookStats as jest.Mock).mockResolvedValue({ status: 'ok', value: [stat('taper', 0.92), stat('crop', null)] });
  await render(<LookStatsCard de={false} />);
  expect(await screen.findByText('92% exact (12)')).toBeTruthy();
  expect(screen.getByText('Rate to come')).toBeTruthy();
  expect(screen.getAllByText('7 confirmed')).toHaveLength(2);
  expect(screen.getByText('The rate appears once enough clients have rated.')).toBeTruthy();
  expect(fetchBarberLookStats).toHaveBeenCalledWith('x');
});

it('nudges a barber with no proven look yet', async () => {
  (fetchBarberLookStats as jest.Mock).mockResolvedValue({ status: 'ok', value: [] });
  await render(<LookStatsCard de />);
  expect(await screen.findByText(/Halte nach einem abgeschlossenen Termin das Ergebnis fest/)).toBeTruthy();
});

it('stays hidden when the stats cannot load', async () => {
  (fetchBarberLookStats as jest.Mock).mockResolvedValue({ status: 'error', code: 'forbidden', message: 'x', retryable: false });
  await render(<LookStatsCard de={false} />);
  expect(screen.queryByTestId('barber-dashboard-looks')).toBeNull();
});
