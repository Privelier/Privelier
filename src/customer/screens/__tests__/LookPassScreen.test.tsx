/**
 * LookPassScreen (Looks S6): the client's reference next to the result,
 * calm placeholders where a side has no photo, "This look again" into the
 * normal booking with the same barber and service, and the empty state.
 * RNTL v14 render() and fireEvent are async.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LookPassScreen from '../LookPassScreen';
import { fetchBookableService, fetchLookStyles, fetchMyLooks, signLookPhotos, signReferencePhoto } from '../../../looks/looksData';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../../../looks/looksData', () => ({
  fetchBookableService: jest.fn(),
  fetchLookStyles: jest.fn(),
  fetchMyLooks: jest.fn(),
  signLookPhotos: jest.fn(),
  signReferencePhoto: jest.fn(),
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

const SHOWN = {
  look_id: 'l-1', booking_id: 'b-1', barber_id: 'x', barber_name: 'Xavier', barber_image: null, styles: ['taper'], status: 'published',
  appointment_date: '2026-10-20', service_id: 's-1', service_name: 'Fade', photo_paths: ['x/one.jpg'], reference_style: 'taper',
  reference_photo_path: 'me/ref.jpg', reference_look_id: null, reference_look_photo: null, can_rebook: true,
};
const HIDDEN = { ...SHOWN, look_id: 'l-2', booking_id: 'b-2', status: 'confirmed', photo_paths: [], reference_photo_path: null, can_rebook: false };
const SERVICE = { id: 's-1', barber_id: 'x', name: 'Fade', price: 35, duration_minutes: 60 };

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [{ key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 }] });
  (fetchMyLooks as jest.Mock).mockResolvedValue({ status: 'ok', value: [SHOWN, HIDDEN] });
  (signLookPhotos as jest.Mock).mockResolvedValue(new Map([['x/one.jpg', 'https://signed/one']]));
  (signReferencePhoto as jest.Mock).mockResolvedValue('https://signed/ref');
});

it('puts the reference next to the result and books the same look again', async () => {
  (fetchBookableService as jest.Mock).mockResolvedValue(SERVICE);
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<LookPassScreen route={{ params: undefined } as never} navigation={navigation as never} />);

  await waitFor(() => expect(screen.getByTestId('customer-look-pass-result-l-1').props.accessibilityLabel).toBe('Result'));
  expect(screen.getByTestId('customer-look-pass-reference-l-1').props.accessibilityLabel).toBe('You asked for');
  expect(signReferencePhoto).toHaveBeenCalledWith('me/ref.jpg');

  await fireEvent.press(screen.getByTestId('customer-look-pass-again-l-1'));
  await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('BookingDateTime', {
    barberId: 'x', barberName: 'Xavier', barberImage: null, service: SERVICE, lookReference: { lookId: 'l-1', style: 'taper' },
  }));
});

it('explains an empty side and offers no rebooking where it cannot work', async () => {
  await render(<LookPassScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never} />);
  await waitFor(() => expect(screen.getByTestId('customer-look-pass-result-l-2').props.accessibilityLabel).toBe('Result: Not shown, so no photo kept'));
  expect(screen.getByTestId('customer-look-pass-reference-l-2').props.accessibilityLabel).toBe('You asked for: Booked without a reference');
  expect(screen.queryByTestId('customer-look-pass-again-l-2')).toBeNull();
});

it('says what fills the pass when it is empty', async () => {
  (fetchMyLooks as jest.Mock).mockResolvedValue({ status: 'ok', value: [] });
  await render(<LookPassScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never} />);
  expect(await screen.findByTestId('customer-look-pass-empty')).toBeTruthy();
});
