/**
 * Barber LookWishesScreen (Looks S5): an open wish without the client's
 * identity, picking an own service, a start that fits the window and a
 * note, sending the offer, and the calm "not free" answer. RNTL v14
 * render() and fireEvent are async.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LookWishesScreen from '../LookWishesScreen';
import { fetchLookStyles, signReferencePhoto } from '../../../looks/looksData';
import { fetchOpenWishes, sendOffer } from '../../../looks/wishData';
import { listOwnServices } from '../../servicesData';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('../../../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'x' } } } })) } },
}));
jest.mock('../../../looks/looksData', () => ({ fetchLookStyles: jest.fn(), signReferencePhoto: jest.fn() }));
jest.mock('../../../looks/wishData', () => ({ fetchOpenWishes: jest.fn(), sendOffer: jest.fn(), withdrawOffer: jest.fn() }));
jest.mock('../../servicesData', () => ({ listOwnServices: jest.fn() }));
jest.mock('../../../shared/components/ReportSheet', () => ({ ReportSheet: () => null }));
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

const WISH = {
  wish_id: 'w-1', style: 'taper', day: '2030-10-30', window_from: '18:00:00', window_to: '19:30:00', expires_at: '2030-10-29T18:00:00Z',
  photo_path: 'c/ref.jpg', my_offer_id: null, my_offer_status: null, my_offer_time: null, my_offer_service_id: null, my_offer_note: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [{ key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 }] });
  (fetchOpenWishes as jest.Mock).mockResolvedValue({ status: 'ok', value: [WISH] });
  (listOwnServices as jest.Mock).mockResolvedValue({ status: 'ok', services: [{ id: 's-1', barber_id: 'x', name: 'Fade', price: 35, duration_minutes: 60 }] });
  (signReferencePhoto as jest.Mock).mockResolvedValue('https://signed/ref');
});

it('offers an own service at a start that fits the window, with a note', async () => {
  (sendOffer as jest.Mock).mockResolvedValue({ status: 'ok', value: null });
  await render(<LookWishesScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn() } as never} />);

  expect(await screen.findByTestId('barber-look-wishes-photo-w-1')).toBeTruthy();
  expect(screen.getByTestId('barber-look-wishes-send-w-1').props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(screen.getByTestId('barber-look-wishes-service-w-1-s-1'));
  expect(screen.queryByTestId('barber-look-wishes-time-w-1-1845')).toBeNull();
  await fireEvent.press(screen.getByTestId('barber-look-wishes-time-w-1-1830'));
  await fireEvent.changeText(screen.getByTestId('barber-look-wishes-note-w-1'), 'Clean taper');
  await fireEvent.press(screen.getByTestId('barber-look-wishes-send-w-1'));

  await waitFor(() => expect(sendOffer).toHaveBeenCalledWith({ wishId: 'w-1', serviceId: 's-1', time: '18:30:00', note: 'Clean taper' }));
  expect(fetchOpenWishes).toHaveBeenCalledTimes(2);
});

it('shows why a start was refused and keeps the draft', async () => {
  (sendOffer as jest.Mock).mockResolvedValue({ status: 'error', code: 'not_free', message: 'You are not free at that time. Pick another start.', retryable: false });
  await render(<LookWishesScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn() } as never} />);
  await fireEvent.press(await screen.findByTestId('barber-look-wishes-service-w-1-s-1'));
  await fireEvent.press(screen.getByTestId('barber-look-wishes-time-w-1-1800'));
  await fireEvent.press(screen.getByTestId('barber-look-wishes-send-w-1'));
  expect(await screen.findByText('You are not free at that time. Pick another start.')).toBeTruthy();
  expect(screen.getByTestId('barber-look-wishes-send-w-1').props.accessibilityState).toMatchObject({ disabled: false });
});

it('says plainly when there is no wish', async () => {
  (fetchOpenWishes as jest.Mock).mockResolvedValue({ status: 'ok', value: [] });
  await render(<LookWishesScreen route={{ params: undefined } as never} navigation={{ goBack: jest.fn() } as never} />);
  expect(await screen.findByTestId('barber-look-wishes-empty')).toBeTruthy();
});
