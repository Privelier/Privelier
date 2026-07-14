/**
 * Integration tests for the barber Studio tab (dashboard). The data layer
 * (../../dashboardData) and the auth profile read (../../../auth/authService)
 * are mocked; the screen is rendered with @testing-library/react-native and
 * driven through its testIDs.
 *
 * Deliberately a SINGLE rich mount. This screen loads via useFocusEffect + an
 * async load(); like every other focus-effect screen in this codebase it is not
 * exhaustively component-tested (RNTL's async-act environment degrades after
 * several such mounts in one file). The derivation logic is covered thoroughly
 * by dashboardData.test.ts and the screen wiring by the Maestro E2E flow, so
 * one fixture here asserts everything structural in a single mount: the seven
 * preserved testIDs, the bookings overview (pending pill / next appointment /
 * upcoming line), the readiness meter and its states, and both deep-link paths.
 */
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
  services: [{ id: 's1', barber_id: 'b1', name: 'Fade', price: 40, duration_minutes: 45 }],
  windows: [{ id: 'w1' }] as DashboardView['windows'],
  verification: 'pending',
  overview: {
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
        status: 'accepted',
        created_at: '2026-07-01T00:00:00Z',
      },
      serviceName: 'Fade',
      counterpartName: 'Sam',
    },
  },
  readiness: {
    items: [
      { key: 'services', state: 'complete' },
      { key: 'availability', state: 'incomplete' },
      { key: 'portfolio', state: 'incomplete' },
      { key: 'verification', state: 'in_progress' },
    ],
    completeCount: 1,
    total: 4,
    isLive: false,
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
  it('renders the preserved testIDs, the overview glance, the readiness meter, and both deep-links', async () => {
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

    // Overview glance: pending pill, next appointment (name + time), upcoming line.
    expect(screen.getByText('2 pending')).toBeTruthy();
    expect(screen.getByText(/Sam/)).toBeTruthy();
    expect(screen.getByText(/14:30/)).toBeTruthy();
    expect(screen.getByText('1 in the next 7 days')).toBeTruthy();

    // Readiness meter: the "N of 4" status and the four item rows.
    expect(screen.getByTestId('barber-dashboard-readiness')).toBeTruthy();
    expect(screen.getByText('1 of 4 complete')).toBeTruthy();
    expect(screen.getByTestId('barber-dashboard-readiness-verification')).toBeTruthy();

    // A complete item is inert; an incomplete one deep-links to its fixer.
    expect(
      screen.getByTestId('barber-dashboard-readiness-services').props.accessibilityState?.disabled
    ).toBe(true);
    fireEvent.press(screen.getByTestId('barber-dashboard-readiness-availability'));
    expect(navigation.navigate).toHaveBeenCalledWith('Availability');

    // The overview deep-links to Requests (glance only — Requests owns mutations).
    fireEvent.press(screen.getByTestId('barber-dashboard-overview'));
    expect(navigation.navigate).toHaveBeenCalledWith('Requests');
  });
});
