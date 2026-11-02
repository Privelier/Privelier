/**
 * ReviewSubmitScreen with the 'looks' flag on (Looks S2): the optional
 * look-match answer is prefilled from the barber's look, sent only after the
 * review succeeded, and its failure never blocks the review. With the flag
 * off the screen is unchanged (ReviewSubmitScreen.test.tsx).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReviewSubmitScreen from '../ReviewSubmitScreen';
import { submitReview } from '../../reviewsData';
import { fetchLookForBooking, fetchLookStyles, submitLookFeedback } from '../../../looks/looksData';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../../shared/featureFlags', () => ({ useFeatureFlag: () => true }));
jest.mock('../../reviewsData', () => ({ submitReview: jest.fn() }));
jest.mock('../../../looks/looksData', () => ({
  fetchLookForBooking: jest.fn(),
  fetchLookStyles: jest.fn(),
  submitLookFeedback: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null, Ionicons: () => null }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: { background: '#121214', surface: '#1B1B1E', border: '#2A2A2E', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B', accentText: '#BFA06B', onAccent: '#121214', error: '#A8453E', errorText: '#A8453E' },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children, ...props }: { children?: unknown }) => React.createElement(View, props, children) };
});

const route = { params: { bookingId: 'bk1', barberId: 'ba1', barberName: 'Marco', serviceName: 'Fade' } } as never;

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [
    { key: 'skin_fade', label_en: 'Skin fade', label_de: 'Skin Fade', sort_order: 1 },
    { key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 },
  ] });
  (fetchLookForBooking as jest.Mock).mockResolvedValue({ status: 'ok', value: { styles: ['taper'] } });
  (submitReview as jest.Mock).mockResolvedValue({ status: 'ok', review: {} });
});

it('sends the look answer after the review, prefilled with the barber\'s style', async () => {
  (submitLookFeedback as jest.Mock).mockResolvedValue({ status: 'error', code: 'network', message: 'x', retryable: true });
  await render(<ReviewSubmitScreen route={route} navigation={{ goBack: jest.fn() } as never} />);

  expect(await screen.findByTestId('customer-review-look')).toBeTruthy();
  await waitFor(() => expect(screen.getByTestId('customer-review-look-style-taper').props.accessibilityState).toMatchObject({ selected: true }));
  await fireEvent.press(screen.getByTestId('customer-review-submit-stars-star-5'));
  await fireEvent.press(screen.getByTestId('customer-review-look-verdict-exact'));
  await fireEvent.press(screen.getByTestId('customer-review-submit-submit'));

  await waitFor(() => expect(submitLookFeedback).toHaveBeenCalledWith({ bookingId: 'bk1', style: 'taper', verdict: 'exact' }));
  expect(submitReview).toHaveBeenCalled();
  // The look answer failed, the review still succeeded.
  expect(await screen.findByTestId('customer-review-submit-success')).toBeTruthy();
});

it('sends no look answer when none was given', async () => {
  await render(<ReviewSubmitScreen route={route} navigation={{ goBack: jest.fn() } as never} />);
  await fireEvent.press(await screen.findByTestId('customer-review-submit-stars-star-4'));
  await fireEvent.press(screen.getByTestId('customer-review-submit-submit'));
  expect(await screen.findByTestId('customer-review-submit-success')).toBeTruthy();
  expect(submitLookFeedback).not.toHaveBeenCalled();
});
