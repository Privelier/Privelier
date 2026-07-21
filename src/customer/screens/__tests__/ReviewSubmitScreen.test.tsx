/**
 * Integration tests for the customer ReviewSubmitScreen (build-order step 18).
 * The data layer (../../reviewsData submitReview) is mocked; the screen is
 * rendered with @testing-library/react-native and driven through its testIDs.
 * The real StarRatingInput is used (only its icon font is mocked), so the
 * rating-gate wiring is exercised end to end.
 *
 * This screen has NO useFocusEffect, so multiple mounts in one file are safe
 * (unlike the focus-effect screens the repo restricts to a single mount).
 *
 * NB: RNTL v14 render() is async — every test awaits it before touching the
 * global screen.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ReviewSubmitScreen from '../ReviewSubmitScreen';
import { submitReview } from '../../reviewsData';

jest.mock('../../reviewsData', () => ({ submitReview: jest.fn() }));

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    Feather: () => null,
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      background: '#121214',
      surface: '#1B1B1E',
      border: '#2A2A2E',
      textPrimary: '#F5F1E8',
      textSecondary: '#9A968C',
      accent: '#BFA06B',
      accentText: '#BFA06B',
      onAccent: '#121214',
      error: '#A8453E',
      errorText: '#A8453E',
    },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement(View, props, children),
  };
});

const mockSubmit = submitReview as jest.Mock;

const route = {
  params: {
    bookingId: 'bk1',
    barberId: 'ba1',
    barberName: 'Marco',
    serviceName: 'Fade',
  },
} as never;

function makeNavigation() {
  return { goBack: jest.fn() } as never;
}

beforeEach(() => {
  mockSubmit.mockReset();
});

// ONE comprehensive mount (repo convention for full-screen mounts — RNTL v14's
// async-act environment degrades after the first such mount in a file, so the
// gate, both failure branches, and the success/navigate-back path are all
// driven sequentially against a single fixture). The generic-error and
// already-reviewed branches leave the form intact, so submit can be re-pressed;
// the 'ok' path is exercised last because it is terminal (success → goBack).
describe('ReviewSubmitScreen', () => {
  it('gates on a rating, surfaces both failure states, and navigates back on success', async () => {
    const navigation = makeNavigation();
    const goBack = (navigation as unknown as { goBack: jest.Mock }).goBack;
    await render(<ReviewSubmitScreen route={route} navigation={navigation} />);

    // 1) Gate: with no rating picked, submit is disabled and pressing it is a
    //    no-op (Pressable ignores the press while disabled).
    const submit = screen.getByTestId('customer-review-submit-submit');
    expect(submit.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit);
    expect(mockSubmit).not.toHaveBeenCalled();

    // Pick 4 stars and type a comment; the button un-gates.
    await act(async () => {
      fireEvent.press(screen.getByTestId('customer-review-submit-stars-star-4'));
      fireEvent.changeText(screen.getByTestId('customer-review-submit-comment'), 'Great cut');
    });
    expect(screen.getByTestId('customer-review-submit-submit').props.accessibilityState.disabled).toBe(false);

    // 2) Generic failure → inline message, still on the form.
    mockSubmit.mockResolvedValueOnce({
      status: 'error',
      code: 'forbidden',
      message: 'You do not have permission to do that.',
      retryable: false,
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('customer-review-submit-submit'));
    });
    expect(mockSubmit).toHaveBeenLastCalledWith({
      bookingId: 'bk1',
      barberId: 'ba1',
      rating: 4,
      comment: 'Great cut',
    });
    expect(screen.getByText('You do not have permission to do that.')).toBeTruthy();
    expect(goBack).not.toHaveBeenCalled();

    // 3) Duplicate review → calm already-reviewed copy, still on the form.
    mockSubmit.mockResolvedValueOnce({ status: 'already_reviewed' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('customer-review-submit-submit'));
    });
    expect(screen.getByTestId('customer-review-submit-error')).toBeTruthy();
    expect(goBack).not.toHaveBeenCalled();

    // 4) Success → success state, then a short (real) pause navigates back.
    mockSubmit.mockResolvedValueOnce({ status: 'ok', review: { id: 'r1' } });
    await act(async () => {
      fireEvent.press(screen.getByTestId('customer-review-submit-submit'));
    });
    expect(screen.getByTestId('customer-review-submit-success')).toBeTruthy();
    await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  });
});
