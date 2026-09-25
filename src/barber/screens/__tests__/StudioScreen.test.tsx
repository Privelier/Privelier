/** Studio presentation and navigation over the dashboard's section results. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import StudioScreen from '../StudioScreen';
import { fetchOwnProfile } from '../../../auth/authService';
import { fetchDashboardView } from '../../dashboardData';
import type { DashboardView } from '../../types';

// useFocusEffect needs a navigation container at runtime. Match the established
// test shim used by the other barber screens, including its callback cleanup.
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
    useNavigation: () => ({ navigate: jest.fn() }),
  };
});

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

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
      successText: '#51785C',
    },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));

jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
jest.mock('../../dashboardData', () => ({ fetchDashboardView: jest.fn() }));
jest.mock('../../../RoleContext', () => ({ useExitRole: () => jest.fn() }));

// SafeAreaView must forward props so the barber-dashboard-screen testID (on the
// SafeAreaView itself) survives into the tree.
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const passthrough = ({ children }: { children?: unknown }) => children ?? null;
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockFetchProfile = fetchOwnProfile as jest.Mock;
const mockFetchView = fetchDashboardView as jest.Mock;
const navigation = { navigate: jest.fn() };

// A rich mixed fixture: pending requests + a confirmed next appointment, and a
// half-complete readiness meter (one complete, two incomplete, verification
// mid-review) — enough to assert every branch in one mount.
const MIXED_VIEW: DashboardView = {
  services: { status: 'ok', data: [{ id: 's1', barber_id: 'b1', name: 'Fade', price: 40, duration_minutes: 45 }] },
  availability: { status: 'ok', data: [{ id: 'w1' }] as Extract<DashboardView['availability'], { status: 'ok' }>['data'] },
  portfolio: { status: 'ok', data: [] },
  profile: { status: 'ok', data: { verification: 'pending', bio: 'Ten years of fades.' } },
  location: { status: 'ok', data: 'Prinsengracht 263, Amsterdam' },
  analytics: { status: 'ok', data: {
    completedWeek: 3,
    completedMonth: 6,
    completedAllTime: 14,
    bookedValueWeek: 120,
    bookedValueMonth: 240,
    bookedValueAllTime: 560,
    pendingCount: 2,
    upcomingCount: 1,
    nextAppointment: { date: '2026-07-15', time: '14:30:00', customerName: 'Sam', serviceName: 'Fade' },
    weeklyTrend: [{ weekStart: '2026-07-13', completedCuts: 3, bookedValue: 120 }],
    ratingAverage: 4.8,
    reviewCount: 6,
    repeatCustomerCount: 2,
    topServices: [{ name: 'Fade', completedCuts: 5, bookedValue: 200 }],
    busiestWeekday: { weekday: 'Friday', completedCuts: 4 },
  } },
  readiness: {
    items: [
      { key: 'services', state: 'complete' },
      { key: 'availability', state: 'incomplete' },
      { key: 'location', state: 'complete' },
      { key: 'portfolio', state: 'incomplete' },
      { key: 'bio', state: 'incomplete' },
      { key: 'verification', state: 'in_progress' },
    ],
    completeCount: 2,
    total: 6,
    isLive: false,
    unavailableCount: 0,
  },
};

beforeEach(() => {
  mockFetchProfile.mockReset();
  mockFetchView.mockReset();
  navigation.navigate.mockReset();
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
});

describe('StudioScreen dashboard', () => {
  it('shows dashboard-shaped placeholders without inventing the barber name on first load', async () => {
    mockFetchProfile.mockImplementation(() => new Promise(() => {}));
    await render(<StudioScreen navigation={navigation as never} route={{} as never} />);

    expect(screen.getByTestId('barber-dashboard-loading').props.accessibilityRole).toBe('progressbar');
    expect(screen.queryByText('there.')).toBeNull();
    expect(screen.queryByTestId('barber-dashboard-overview')).toBeNull();
    expect(screen.getByTestId('barber-dashboard-logout')).toBeTruthy();
  });

  it('gives a new barber a calm analytics empty state', async () => {
    mockFetchProfile.mockResolvedValue({ status: 'ok', profile: { id: 'u1', name: 'Ada Lovelace' } });
    mockFetchView.mockResolvedValue({
      ...MIXED_VIEW,
      analytics: { status: 'ok', data: {
        ...(MIXED_VIEW.analytics as Extract<DashboardView['analytics'], { status: 'ok' }>).data,
        completedWeek: 0,
        completedMonth: 0,
        completedAllTime: 0,
        bookedValueWeek: 0,
        bookedValueMonth: 0,
        bookedValueAllTime: 0,
        pendingCount: 0,
        upcomingCount: 0,
        nextAppointment: null,
        weeklyTrend: Array.from({ length: 8 }, (_, index) => ({ weekStart: `2026-09-${String(index + 1).padStart(2, '0')}`, completedCuts: 0, bookedValue: 0 })),
        ratingAverage: null,
        reviewCount: 0,
        repeatCustomerCount: 0,
        topServices: [],
        busiestWeekday: null,
      } },
    });
    await render(<StudioScreen navigation={navigation as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('barber-dashboard-earnings-trend')).toBeTruthy());
    expect(screen.getByText('Your first completed booking will start this trend.')).toBeTruthy();
    expect(screen.getByText('You’re all caught up')).toBeTruthy();
    expect(screen.getByText('Nothing scheduled yet.')).toBeTruthy();
    expect(screen.getByText(/no reviews yet/)).toBeTruthy();
    expect(screen.queryByTestId('barber-dashboard-rating')).toBeNull();
  });

  it('hides the setup checklist after all six setup steps are complete', async () => {
    mockFetchProfile.mockResolvedValue({ status: 'ok', profile: { id: 'u1', name: 'Ada Lovelace' } });
    mockFetchView.mockResolvedValue({
      ...MIXED_VIEW,
      readiness: {
        items: MIXED_VIEW.readiness.items.map((item) => ({ ...item, state: 'complete' as const })),
        completeCount: 6,
        unavailableCount: 0,
        total: 6,
        isLive: true,
      },
    });
    await render(<StudioScreen navigation={navigation as never} route={{} as never} />);
    await waitFor(() => expect(screen.queryByTestId('barber-dashboard-readiness')).toBeNull());
    expect(screen.getByTestId('barber-dashboard-overview')).toBeTruthy();
  });

  it('does not turn a failed section into an empty state and retries it', async () => {
    mockFetchProfile.mockResolvedValue({ status: 'ok', profile: { id: 'u1', name: 'Ada Lovelace' } });
    const failedView: DashboardView = {
      ...MIXED_VIEW,
      services: { status: 'error', code: 'network', message: 'We could not reach the server.', retryable: true },
      readiness: {
        ...MIXED_VIEW.readiness,
        items: MIXED_VIEW.readiness.items.map((item) =>
          item.key === 'services' ? { ...item, state: 'unavailable' } : item
        ),
        completeCount: 0,
        unavailableCount: 1,
        isLive: null,
      },
    };
    mockFetchView.mockResolvedValue(failedView);

    await render(<StudioScreen navigation={navigation as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('barber-dashboard-services-unavailable')).toBeTruthy());
    expect(screen.getByText('Service summary unavailable')).toBeTruthy();
    expect(screen.getByText('0 confirmed complete; 1 unavailable')).toBeTruthy();
    expect(screen.queryByText('No services yet.')).toBeNull();

    mockFetchView.mockResolvedValue(MIXED_VIEW);
    await act(async () => {
      fireEvent.press(screen.getByTestId('barber-dashboard-services-unavailable-retry'));
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText(/1 service/)).toBeTruthy());
    expect(mockFetchView).toHaveBeenCalledTimes(2);
  });

  it('prioritizes bookings, preserves dashboard routes, and shows confirmed readiness', async () => {
    mockFetchProfile.mockResolvedValue({ status: 'ok', profile: { id: 'u1', name: 'Ada Lovelace' } });
    mockFetchView.mockResolvedValue(MIXED_VIEW);

    await render(<StudioScreen navigation={navigation as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('barber-dashboard-overview')).toBeTruthy());

    // Preserved testIDs (Maestro / login E2E depend on these).
    expect(screen.getByTestId('barber-dashboard-screen')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-logout')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-verification')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-services')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-availability')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-bio')).toBeTruthy();

    // Analytics show genuine server aggregates and the next accepted appointment.
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Open requests')).toBeTruthy();
    expect(screen.getByText('Umsatz aus Buchungen · diesen Monat')).toBeTruthy();
    expect(screen.getByText(/No payments are processed/)).toBeTruthy();
    expect(screen.getByText(/Sam/)).toBeTruthy();
    expect(screen.getByText(/14:30/)).toBeTruthy();
    expect(screen.getByText('1 in the next 7 days')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-earnings-trend')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-rating')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('€240').props.style)).toMatchObject({
      fontFamily: 'Inter_600SemiBold',
      fontVariant: ['lining-nums', 'tabular-nums'],
    });

    // Incomplete setup remains visible, including pending verification.
    expect(screen.getByTestId('barber-dashboard-readiness')).toBeTruthy();
    expect(screen.getByText('2 of 6 complete')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-readiness-verification')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-readiness-bio')).toBeTruthy();
    expect(screen.getByText('Verification is under manual review.')).toBeTruthy();

    // A complete item is inert; an incomplete one deep-links to its fixer.
    expect(
      screen.getByTestId('barber-dashboard-readiness-services').props.accessibilityState?.disabled
    ).toBe(true);
    fireEvent.press(screen.getByTestId('barber-dashboard-readiness-availability'));
    expect(navigation.navigate).toHaveBeenCalledWith('Availability');

    // Bio: both the readiness row and the management card deep-link to BioEdit.
    fireEvent.press(screen.getByTestId('barber-dashboard-readiness-bio'));
    expect(navigation.navigate).toHaveBeenCalledWith('BioEdit');
    fireEvent.press(screen.getByTestId('barber-dashboard-bio'));
    expect(navigation.navigate).toHaveBeenCalledWith('BioEdit');
    fireEvent.press(screen.getByTestId('barber-dashboard-portfolio'));
    expect(navigation.navigate).toHaveBeenCalledWith('Portfolio');

    // Location card (Explore Run A): shows the saved address, links to LocationEdit.
    expect(screen.getByText('Prinsengracht 263, Amsterdam')).toBeTruthy();
    fireEvent.press(screen.getByTestId('barber-dashboard-location'));
    expect(navigation.navigate).toHaveBeenCalledWith('LocationEdit');

    // The overview deep-links to Requests (glance only — Requests owns mutations).
    fireEvent.press(screen.getByTestId('barber-dashboard-overview'));
    expect(navigation.navigate).toHaveBeenCalledWith('Requests');
  });

});
