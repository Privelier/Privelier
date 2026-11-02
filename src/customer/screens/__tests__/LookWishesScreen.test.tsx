/**
 * LookWishesScreen (Looks S5): a wish with its offers, "Book at HH:MM"
 * straight into the address step carrying the offer, taking a wish back,
 * and the empty state. RNTL v14 render() and fireEvent are async.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LookWishesScreen from '../LookWishesScreen';
import { fetchBookableService, fetchLookStyles } from '../../../looks/looksData';
import { cancelWish, fetchMyWishes, fetchWishOffers } from '../../../looks/wishData';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../../../looks/looksData', () => ({ fetchBookableService: jest.fn(), fetchLookStyles: jest.fn() }));
jest.mock('../../../looks/wishData', () => ({ cancelWish: jest.fn(), fetchMyWishes: jest.fn(), fetchWishOffers: jest.fn() }));
jest.mock('../../../shared/components/ReportSheet', () => ({ ReportSheet: () => null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
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

const WISH = {
  id: 'w-1', customer_id: 'me', style: 'taper', day: '2030-10-30', window_from: '18:00:00', window_to: '21:00:00',
  photo_path: 'me/ref.jpg', status: 'open', booking_id: null, expires_at: '2030-10-29T18:00:00Z', created_at: '2030-10-28T10:00:00Z',
};
const OFFER = {
  offer_id: 'o-1', wish_id: 'w-1', barber_id: 'x', barber_name: 'Xavier', barber_image: null, barber_rating: 4.8, proof_count: 4,
  feedback_count: 0, hit_rate: null, service_id: 's-1', service_name: 'Fade', service_price: 35, service_duration: 60,
  proposed_time: '18:30:00', note: 'Clean taper', created_at: '2030-10-28T11:00:00Z',
};
const SERVICE = { id: 's-1', barber_id: 'x', name: 'Fade', price: 35, duration_minutes: 60 };

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [{ key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 }] });
  (fetchMyWishes as jest.Mock).mockResolvedValue({ status: 'ok', value: [WISH] });
  (fetchWishOffers as jest.Mock).mockResolvedValue({ status: 'ok', value: [OFFER] });
});

it('books an offer straight into the address step and carries the offer along', async () => {
  (fetchBookableService as jest.Mock).mockResolvedValue(SERVICE);
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<LookWishesScreen route={{ params: undefined } as never} navigation={navigation as never} />);

  expect(await screen.findByText('4 confirmed Taper looks')).toBeTruthy();
  expect(screen.getByText('“Clean taper”')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-look-wishes-book-o-1'));
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('BookingLocation', {
    barberId: 'x', barberName: 'Xavier', barberImage: null, service: SERVICE, date: '2030-10-30', time: '18:30:00',
    lookReference: { lookId: null, style: 'taper', photoPath: 'me/ref.jpg', offerId: 'o-1' },
  }));
});

it('takes an open wish back', async () => {
  (cancelWish as jest.Mock).mockResolvedValue({ status: 'ok', value: null });
  await render(<LookWishesScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never} />);
  await fireEvent.press(await screen.findByTestId('customer-look-wishes-cancel-w-1'));
  await waitFor(() => expect(cancelWish).toHaveBeenCalledWith('w-1'));
  expect(fetchMyWishes).toHaveBeenCalledTimes(2);
});

it('shows booked wishes without offers or actions, and an empty state', async () => {
  (fetchMyWishes as jest.Mock).mockResolvedValueOnce({ status: 'ok', value: [{ ...WISH, status: 'booked', booking_id: 'bk-1' }] });
  const view = await render(<LookWishesScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never} />);
  expect(await screen.findByText('Booked. Find it under Bookings.')).toBeTruthy();
  expect(screen.queryByTestId('customer-look-wishes-offer-o-1')).toBeNull();
  expect(screen.queryByTestId('customer-look-wishes-cancel-w-1')).toBeNull();
  await view.unmount();

  (fetchMyWishes as jest.Mock).mockResolvedValueOnce({ status: 'ok', value: [] });
  await render(<LookWishesScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never} />);
  expect(await screen.findByTestId('customer-look-wishes-empty')).toBeTruthy();
});
