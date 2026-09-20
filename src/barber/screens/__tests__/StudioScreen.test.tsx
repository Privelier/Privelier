/** Studio presentation and navigation over the dashboard's section results. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import StudioScreen from '../StudioScreen';
import { fetchOwnProfile } from '../../../auth/authService';
import { fetchDashboardView } from '../../dashboardData';
import type { DashboardView } from '../../types';

// useFocusEffect needs a navigation container at runtime; mock it to a plain
// mount effect (deps [] — runs once) so the screen loads its data without a
// real navigator. Using the canonical react instance avoids a second copy that
// would make React see overlapping act() scopes.
jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(() => cb(), []),
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
  overview: { status: 'ok', data: {
    pendingCount: 2,
    upcomingCount: 1,
    nextAppointment: {
      booking: {
        id: 'b1',
        customer_id: 'c1',
        barber_id: 'brb1',
        service_id: 's1',
        date: '2026-07-15',
        time: '14:30:00',
        location: 'Home',
        price: 40,
        duration_minutes: 45,
        status: 'accepted',
        created_at: '2026-07-01T00:00:00Z',
      },
      serviceName: 'Fade',
      counterpartName: 'Sam',
    },
  } },
  readiness: {
    items: [
      { key: 'services', state: 'complete' },
      { key: 'availability', state: 'incomplete' },
      { key: 'portfolio', state: 'incomplete' },
      { key: 'bio', state: 'incomplete' },
      { key: 'verification', state: 'in_progress' },
    ],
    completeCount: 1,
    total: 5,
    isLive: false,
    unavailableCount: 0,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
});

describe('StudioScreen dashboard', () => {
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

    // Bookings show a pending count and the next accepted appointment.
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Pending requests')).toBeTruthy();
    expect(screen.getByText(/Sam/)).toBeTruthy();
    expect(screen.getByText(/14:30/)).toBeTruthy();
    expect(screen.getByText('1 upcoming in the next 7 days')).toBeTruthy();

    // Readiness stays a five-item setup state, separate from verification.
    expect(screen.getByTestId('barber-dashboard-readiness')).toBeTruthy();
    expect(screen.getByText('1 of 5 complete')).toBeTruthy();
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
    mockFetchView.mockResolvedValueOnce(failedView).mockResolvedValueOnce(MIXED_VIEW);

    render(<StudioScreen navigation={navigation as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('barber-dashboard-services-unavailable')).toBeTruthy());
    expect(screen.getByText('Service summary unavailable')).toBeTruthy();
    expect(screen.getByText('0 confirmed complete; 1 unavailable')).toBeTruthy();
    expect(screen.queryByText('No services yet.')).toBeNull();

    fireEvent.press(screen.getByTestId('barber-dashboard-services-unavailable-retry'));
    await waitFor(() => expect(screen.getByText(/1 service/)).toBeTruthy());
    expect(mockFetchView).toHaveBeenCalledTimes(2);
  });
});
