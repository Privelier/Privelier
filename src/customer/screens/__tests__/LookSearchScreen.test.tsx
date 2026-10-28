/**
 * LookSearchScreen (Looks S4): style, window, instant matches, and "Book"
 * straight into the address step with the style and photo as reference.
 * RNTL v14 render() and fireEvent are async.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LookSearchScreen from '../LookSearchScreen';
import { fetchBookableService, fetchLookStyles, matchLook } from '../../../looks/looksData';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../../looks/looksData', () => ({
  fetchBookableService: jest.fn(),
  fetchLookStyles: jest.fn(),
  matchLook: jest.fn(),
  removeReferencePhoto: jest.fn(),
  uploadReferencePhoto: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
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

const MATCH = {
  barber_id: 'x', barber_name: 'Xavier', barber_image: null, barber_rating: 4.8, proof_count: 6, feedback_count: 9, hit_rate: 0.89,
  service_id: 's-1', service_name: 'Fade', service_price: 35, service_duration: 60, first_free_time: '18:30:00',
};
const SERVICE = { id: 's-1', barber_id: 'x', name: 'Fade', price: 35, duration_minutes: 60 };

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [{ key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 }] });
});

it('finds free proven barbers and books straight into the address step', async () => {
  (matchLook as jest.Mock).mockResolvedValue({ status: 'ok', value: [MATCH] });
  (fetchBookableService as jest.Mock).mockResolvedValue(SERVICE);
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<LookSearchScreen route={{ params: { style: 'taper' } } as never} navigation={navigation as never} />);

  await fireEvent.press(await screen.findByTestId('customer-look-search-window-evening'));
  await fireEvent.press(screen.getByTestId('customer-look-search-search'));
  expect(await screen.findByText('Taper: 89% exact, 9 ratings')).toBeTruthy();
  const [call] = (matchLook as jest.Mock).mock.calls;
  expect(call[0]).toMatchObject({ style: 'taper', from: '18:00:00', to: '21:00:00' });

  await fireEvent.press(screen.getByTestId('customer-look-search-book-x'));
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('BookingLocation', expect.objectContaining({
    barberId: 'x', service: SERVICE, time: '18:30:00', lookReference: { lookId: null, style: 'taper', photoPath: null },
  })));
});

it('says plainly when nobody with proof is free', async () => {
  (matchLook as jest.Mock).mockResolvedValue({ status: 'ok', value: [] });
  await render(<LookSearchScreen route={{ params: { style: 'taper' } } as never} navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never} />);
  await fireEvent.press(await screen.findByTestId('customer-look-search-search'));
  expect(await screen.findByTestId('customer-look-search-empty')).toBeTruthy();
});

it('cannot search before a style is picked', async () => {
  await render(<LookSearchScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never} />);
  expect((await screen.findByTestId('customer-look-search-search')).props.accessibilityState).toMatchObject({ disabled: true });
});
