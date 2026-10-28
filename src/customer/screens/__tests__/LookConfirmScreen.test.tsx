/**
 * LookConfirmScreen (Looks S2): the two answers and the take-back actions,
 * driven through the Maestro testIDs with the data layer mocked.
 * RNTL v14 render() is async.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LookConfirmScreen from '../LookConfirmScreen';
import { answerLook, fetchLookForBooking, fetchLookStyles, signLookPhotos, takeBackLook } from '../../../looks/looksData';
import { reportUser } from '../../../shared/moderationData';
import type { Look } from '../../../looks/types';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../../looks/looksData', () => ({
  answerLook: jest.fn(),
  fetchLookForBooking: jest.fn(),
  fetchLookStyles: jest.fn(),
  signLookPhotos: jest.fn(),
  takeBackLook: jest.fn(),
}));
jest.mock('../../../shared/moderationData', () => ({ reportUser: jest.fn() }));
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

const LOOK: Look = {
  id: 'look-1', booking_id: 'b-1', barber_id: 'x', customer_id: 'a', service_id: 's', styles: ['skin_fade'],
  status: 'draft', no_face_confirmed: true, submitted_at: new Date().toISOString(), responded_at: null, consented_at: null,
  created_at: new Date().toISOString(),
  look_photos: [{ id: 'p1', look_id: 'look-1', storage_path: 'x/one.jpg', position: 1 }],
};

const route = { params: { bookingId: 'b-1' } } as never;
const navigation = { goBack: jest.fn() } as never;

beforeEach(() => {
  jest.clearAllMocks();
  for (const fn of [answerLook, fetchLookForBooking, takeBackLook, reportUser]) (fn as jest.Mock).mockReset();
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [{ key: 'skin_fade', label_en: 'Skin fade', label_de: 'Skin Fade', sort_order: 1 }] });
  (signLookPhotos as jest.Mock).mockResolvedValue(new Map([['x/one.jpg', 'https://signed/one']]));
});

it('asks "Is this your cut?", then whether it may be shown, and publishes', async () => {
  (fetchLookForBooking as jest.Mock).mockResolvedValue({ status: 'ok', value: LOOK });
  (answerLook as jest.Mock).mockResolvedValue({ status: 'ok', value: { ...LOOK, status: 'published' } });
  await render(<LookConfirmScreen route={route} navigation={navigation} />);

  expect(await screen.findByText('Is this your cut?')).toBeTruthy();
  expect(screen.getByTestId('customer-look-confirm-photo-1')).toBeTruthy();
  expect(screen.getByText('Style: Skin fade')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('customer-look-confirm-mine-yes'));
  expect(screen.getByText('May it be shown?')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('customer-look-confirm-show-yes'));

  await waitFor(() => expect(answerLook).toHaveBeenCalledWith(LOOK, { isMine: true, show: true }));
  expect(await screen.findByText('Your look is shown')).toBeTruthy();
  expect(screen.getByTestId('customer-look-confirm-hide')).toBeTruthy();
  expect(screen.getByTestId('customer-look-confirm-withdraw')).toBeTruthy();
});

it('declines in one tap when it is not the client\'s cut', async () => {
  (fetchLookForBooking as jest.Mock).mockResolvedValue({ status: 'ok', value: LOOK });
  (answerLook as jest.Mock).mockResolvedValue({ status: 'ok', value: { ...LOOK, status: 'declined' } });
  await render(<LookConfirmScreen route={route} navigation={navigation} />);
  await fireEvent.press(await screen.findByTestId('customer-look-confirm-mine-no'));
  await waitFor(() => expect(answerLook).toHaveBeenCalledWith(LOOK, { isMine: false, show: false }));
  expect(await screen.findByText('Declined')).toBeTruthy();
});

it('lets the client stop showing a published look and report it', async () => {
  const published = { ...LOOK, status: 'published' as const };
  (fetchLookForBooking as jest.Mock).mockResolvedValue({ status: 'ok', value: published });
  (takeBackLook as jest.Mock).mockResolvedValue({ status: 'ok', value: { ...published, status: 'confirmed' } });
  (reportUser as jest.Mock).mockResolvedValue({ status: 'ok' });
  await render(<LookConfirmScreen route={route} navigation={navigation} />);

  await fireEvent.press(await screen.findByTestId('customer-look-confirm-hide'));
  await waitFor(() => expect(takeBackLook).toHaveBeenCalledWith(published, 'hide'));
  expect(await screen.findByText('Confirmed as your cut')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('customer-look-confirm-report'));
  await waitFor(() => expect(reportUser).toHaveBeenCalledWith({ target: { type: 'look', lookId: 'look-1' }, reason: 'inappropriate_content' }));
  expect(await screen.findByText('Reported. We review it within 24 hours.')).toBeTruthy();
});

it('shows a calm error and no answers when the look cannot be loaded', async () => {
  (fetchLookForBooking as jest.Mock).mockResolvedValue({ status: 'error', code: 'network', message: 'We could not reach the server.', retryable: true });
  await render(<LookConfirmScreen route={route} navigation={navigation} />);
  expect(await screen.findByTestId('customer-look-confirm-error')).toBeTruthy();
  expect(screen.queryByTestId('customer-look-confirm-mine-yes')).toBeNull();
});
