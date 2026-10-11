import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { OFFLINE_SETTLE_MS, OfflineBanner } from '../OfflineBanner';

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { surface: '#1B1B1E', border: '#333', textPrimary: '#F5F1E8', textSecondary: '#9A968C' },
    fonts: { bodyMedium: 'Inter' },
  }),
}));

const mockUseNetInfo = jest.mocked(useNetInfo);
function setNet(isConnected: boolean | null, isInternetReachable: boolean | null) {
  mockUseNetInfo.mockReturnValue({ isConnected, isInternetReachable } as never);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('never shows while NetInfo is still probing (null)', async () => {
  setNet(null, null);
  await render(<OfflineBanner />);
  await act(async () => { jest.advanceTimersByTime(OFFLINE_SETTLE_MS * 2); });
  expect(screen.queryByTestId('global-offline-banner')).toBeNull();
});

it('ignores a momentary drop shorter than the settle delay', async () => {
  setNet(false, false);
  await render(<OfflineBanner />);
  await act(async () => { jest.advanceTimersByTime(OFFLINE_SETTLE_MS - 100); });
  setNet(true, true);
  await screen.rerender(<OfflineBanner />);
  await act(async () => { jest.advanceTimersByTime(OFFLINE_SETTLE_MS); });
  expect(screen.queryByTestId('global-offline-banner')).toBeNull();
  expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
});

it('shows a truthful alert when offline persists and announces recovery', async () => {
  setNet(true, false);
  await render(<OfflineBanner />);
  await act(async () => { jest.advanceTimersByTime(OFFLINE_SETTLE_MS); });

  const banner = screen.getByTestId('global-offline-banner');
  expect(banner.props.accessibilityRole).toBe('alert');
  expect(screen.getByText("You're offline. Bookings and messages can't be sent right now.")).toBeTruthy();

  setNet(true, true);
  await screen.rerender(<OfflineBanner />);
  await act(async () => { jest.advanceTimersByTime(10); });
  expect(screen.queryByTestId('global-offline-banner')).toBeNull();
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Back online.');
});
