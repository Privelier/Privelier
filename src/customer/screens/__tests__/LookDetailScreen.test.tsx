/**
 * LookDetailScreen (Looks S3): the proof chain, the hit rate, and "Book this
 * look" into the normal booking flow with the look as a reference.
 * RNTL v14 render() and fireEvent are async.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import LookDetailScreen from '../LookDetailScreen';
import { fetchBarberLookStats, fetchBookableService, fetchLookDetail, fetchLookStyles, signLookPhotos } from '../../../looks/looksData';
import type { FeedLook } from '../../../looks/types';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../../shared/moderationData', () => ({ reportUser: jest.fn() }));
jest.mock('../../../looks/looksData', () => ({
  fetchBarberLookStats: jest.fn(),
  fetchBookableService: jest.fn(),
  fetchLookDetail: jest.fn(),
  fetchLookStyles: jest.fn(),
  signLookPhotos: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: { background: '#121214', surface: '#1B1B1E', border: '#2A2A2E', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B', accentText: '#BFA06B', onAccent: '#121214', error: '#A8453E' },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children, ...props }: { children?: unknown }) => React.createElement(View, props, children) };
});

const LOOK: FeedLook = {
  look_id: 'l-1', barber_id: 'x', barber_name: 'Xavier', barber_image: null, barber_rating: 4.9, styles: ['taper'],
  service_id: 's-1', service_name: 'Fade', service_price: 35, service_duration: 60, published_at: '2026-10-28T10:00:00Z',
  review_rating: 5, arrival_confirmed: true, proof_count: 7, photo_paths: ['x/one.jpg'],
};
const SERVICE = { id: 's-1', barber_id: 'x', name: 'Fade', price: 35, duration_minutes: 60 };

function setup(look: FeedLook | null, service: unknown) {
  (fetchLookDetail as jest.Mock).mockResolvedValue({ status: 'ok', value: look });
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [{ key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 }] });
  (signLookPhotos as jest.Mock).mockResolvedValue(new Map([['x/one.jpg', 'https://signed/one']]));
  (fetchBarberLookStats as jest.Mock).mockResolvedValue({ status: 'ok', value: [
    { style: 'taper', label_en: 'Taper', label_de: 'Taper', feedback_count: 12, exact_count: 11, close_count: 1, hit_rate: 0.92, proof_count: 7 },
  ] });
  (fetchBookableService as jest.Mock).mockResolvedValue(service);
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  return navigation;
}

beforeEach(() => jest.clearAllMocks());

it('shows the proof chain and books the look through the normal flow', async () => {
  const navigation = setup(LOOK, SERVICE);
  await render(<LookDetailScreen route={{ params: { lookId: 'l-1' } } as never} navigation={navigation as never} />);

  expect(await screen.findByText('Confirmed by the client as their cut')).toBeTruthy();
  expect(screen.getByText('Client rating: 5 of 5')).toBeTruthy();
  expect(screen.getByText('Arrival shared live')).toBeTruthy();
  expect(screen.getByText('Taper: 92% exact, 12 ratings')).toBeTruthy();
  expect(screen.getByText('7 confirmed looks')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('customer-look-detail-book'));
  expect(navigation.navigate).toHaveBeenCalledWith('BookingDateTime', {
    barberId: 'x', barberName: 'Xavier', barberImage: null, service: SERVICE, lookReference: { lookId: 'l-1', style: 'taper' },
  });
});

it('opens the barber profile when the look service is gone', async () => {
  const navigation = setup({ ...LOOK, review_rating: null, arrival_confirmed: false }, null);
  await render(<LookDetailScreen route={{ params: { lookId: 'l-1' } } as never} navigation={navigation as never} />);
  await fireEvent.press(await screen.findByTestId('customer-look-detail-book'));
  expect(navigation.navigate).toHaveBeenCalledWith('BarberProfile', { barberId: 'x' });
  expect(screen.queryByText('Arrival shared live')).toBeNull();
});

it('says calmly when the look is no longer available', async () => {
  const navigation = setup(null, null);
  await render(<LookDetailScreen route={{ params: { lookId: 'gone' } } as never} navigation={navigation as never} />);
  expect(await screen.findByTestId('customer-look-detail-gone')).toBeTruthy();
  expect(screen.queryByTestId('customer-look-detail-book')).toBeNull();
});
