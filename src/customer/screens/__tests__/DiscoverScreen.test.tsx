import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { BarberDirectoryRow, BookingRow, ServiceRow, UsersRow } from '../../../types';
import { fetchOwnProfile } from '../../../auth/authService';
import { listBarbersByCity, listServicesForBarberIds } from '../../discoveryData';
import DiscoverScreen from '../DiscoverScreen';
import { fetchOwnBookingsView } from '../../bookingsData';
import { getAppLanguage } from '../../../shared/locale';

jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
jest.mock('../../../shared/locale', () => ({ getAppLanguage: jest.fn(() => 'en') }));
jest.mock('../../../shared/components/NotificationBell', () => {
  const React = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return { NotificationBell: ({ testID }: { testID: string }) => React.createElement(Pressable, { testID }) };
});
jest.mock('../../bookingsData', () => ({
  fetchOwnBookingsView: jest.fn(async () => ({ status: 'ok', bookings: [], hasOlder: false, olderCursor: null, barbersById: new Map(), servicesById: new Map() })),
}));
jest.mock('../../discoveryData', () => ({
  listBarbersByCity: jest.fn(),
  listServicesForBarberIds: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));

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
      success: '#51785C',
      successText: '#51785C',
    },
    fonts: {
      headingMedium: 'serif',
      body: 'sans',
      bodyMedium: 'sans',
      bodySemiBold: 'sans',
    },
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

const mockFetchOwnProfile = fetchOwnProfile as jest.Mock;
let focusListener: (() => void) | undefined;
const mockAddListener = jest.fn((event: string, listener: () => void) => {
  if (event === 'focus') focusListener = listener;
  return jest.fn();
});
const mockListBarbers = listBarbersByCity as jest.Mock;
const mockListServices = listServicesForBarberIds as jest.Mock;
const mockGetAppLanguage = getAppLanguage as jest.MockedFunction<typeof getAppLanguage>;

const profile: UsersRow = {
  id: 'customer-1',
  name: 'Nora Customer',
  email: 'nora@example.com',
  phone: null,
  role: 'customer',
  city: 'Nürnberg ',
  country: 'Germany',
  profile_image: null,
  created_at: '2026-09-21T00:00:00.000Z',
  accepted_privacy_version: null,
  accepted_terms_version: null,
  adult_confirmed_at: null,
  legal_accepted_at: null,
};

const barbers: BarberDirectoryRow[] = [
  {
    id: 'a',
    name: 'Amir',
    city: 'Nuremberg',
    country: 'Germany',
    profile_image: 'https://example.com/amir.jpg',
    bio: null,
    rating: 4.9,
    verified: true,
    display_latitude: null,
    display_longitude: null,
  },
  {
    id: 'b',
    name: 'Benedikt',
    city: 'Nuremberg',
    country: 'Germany',
    profile_image: 'https://example.com/benedikt.jpg',
    bio: null,
    rating: 4.7,
    verified: true,
    display_latitude: null,
    display_longitude: null,
  },
  {
    id: 'c',
    name: 'Clara',
    city: 'Nuremberg',
    country: 'Germany',
    profile_image: null,
    bio: null,
    rating: 0,
    verified: true,
    display_latitude: null,
    display_longitude: null,
  },
];

const services: ServiceRow[] = [
  { id: 's1', barber_id: 'a', name: 'Fade', price: 40, duration_minutes: 45 },
  { id: 's2', barber_id: 'b', name: 'Classic cut', price: 50, duration_minutes: 45 },
];

describe('DiscoverScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppLanguage.mockReturnValue('en');
  });

  async function renderDiscovery() {
    mockFetchOwnProfile.mockResolvedValue({ status: 'ok', profile });
    mockListBarbers.mockResolvedValue({ status: 'ok', barbers });
    mockListServices.mockResolvedValue({ status: 'ok', services });
    const navigate = jest.fn();

    await render(<DiscoverScreen navigation={{ navigate, addListener: mockAddListener } as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('customer-home-spotlight')).toBeTruthy());
    // The rotating lead card must disclose that it is not a ranking.
    expect(screen.getByTestId('customer-home-spotlight-note')).toBeTruthy();
    return navigate;
  }

  it('renders truthful discovery for the profile city', async () => {
    await renderDiscovery();
    expect(screen.queryByText('Barber spotlight')).toBeNull();
    expect(screen.getByText(/^(A barber to meet|Ein Barber zum Kennenlernen)$/)).toBeTruthy();

    expect(mockListBarbers).toHaveBeenCalledWith('Nürnberg');
    expect(screen.getByText('Nürnberg, Germany')).toBeTruthy();
    expect(screen.getByText('Verified barbers in Nürnberg')).toBeTruthy();
    expect(screen.queryByText('Nearby masters')).toBeNull();
    expect(screen.queryByText('Style inspiration')).toBeNull();
    expect(screen.queryByText(/within reach/i)).toBeNull();
    expect(screen.getAllByTestId('customer-home-barber-a')).toHaveLength(1);
    expect(screen.getAllByTestId('customer-home-barber-b')).toHaveLength(1);
    expect(screen.getAllByTestId('customer-home-barber-c')).toHaveLength(1);
    expect(screen.getByTestId('customer-barber-avatar-a-image')).toBeTruthy();
    expect(screen.getByTestId('customer-barber-avatar-c-monogram').props.children).toBe('C');
    expect(screen.getByTestId('customer-home-brand-carousel')).toBeTruthy();
    expect(screen.getByTestId('customer-home-brand-message-1')).toBeTruthy();
    expect(screen.getByTestId('customer-home-brand-message-2')).toBeTruthy();
    expect(screen.getByTestId('customer-home-brand-message-3')).toBeTruthy();
    expect(screen.getByTestId('customer-home-brand-message-4')).toBeTruthy();
  });

  it('localizes featured barber cards and describes missing ratings without implying the barber is new', async () => {
    mockGetAppLanguage.mockReturnValue('de');
    await renderDiscovery();

    const unratedCard = screen.getByTestId('customer-home-barber-c');
    expect(unratedCard.props.accessibilityLabel).toContain('Noch keine Bewertungen');
    expect(screen.getAllByText('Noch keine Bewertungen').length).toBeGreaterThan(0);
    expect(unratedCard.props.accessibilityLabel).toContain('Verifizierter Barber');
  });

  it('keeps the notification center reachable from Discover', async () => {
    await renderDiscovery();
    expect(screen.getByTestId('customer-home-notifications')).toBeTruthy();
  });

  it('pulls to refresh in brass and retains verified barbers through a network error', async () => {
    await renderDiscovery();
    const refresh = screen.getByTestId('customer-home-scroll').props.refreshControl;
    expect(refresh.props.tintColor).toBe('#BFA06B');
    expect(refresh.props.colors).toEqual(['#BFA06B']);

    let finish!: (value: Awaited<ReturnType<typeof fetchOwnProfile>>) => void;
    mockFetchOwnProfile.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => refresh.props.onRefresh());
    expect(screen.getByTestId('customer-home-scroll').props.refreshControl.props.refreshing).toBe(true);
    expect(screen.getAllByTestId('customer-home-barber-a').length).toBeGreaterThan(0);

    await act(async () => finish({ status: 'error', code: 'network', retryable: true, message: 'Connection lost.' }));
    await waitFor(() => expect(screen.getByTestId('customer-home-error')).toBeTruthy());
    expect(screen.getAllByTestId('customer-home-barber-a').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('customer-home-loading')).toBeNull();
  });

  it('filters by barber name and preserves profile navigation', async () => {
    const navigate = await renderDiscovery();

    await fireEvent.changeText(screen.getByTestId('customer-home-search'), 'Clara');
    expect(screen.queryByTestId('customer-home-spotlight')).toBeNull();
    expect(screen.getByTestId('customer-home-barber-c')).toBeTruthy();
    expect(screen.queryByTestId('customer-home-barber-a')).toBeNull();
    expect(screen.queryByTestId('customer-home-barber-b')).toBeNull();

    await fireEvent.press(screen.getByTestId('customer-home-barber-c'));
    expect(navigate).toHaveBeenCalledWith('BarberProfile', { barberId: 'c' });
  });

  it('filters by service without retaining the spotlight', async () => {
    await renderDiscovery();

    await fireEvent.press(screen.getByLabelText('Filter by Fade'));
    expect(screen.queryByTestId('customer-home-spotlight')).toBeNull();
    expect(screen.getByTestId('customer-home-barber-a')).toBeTruthy();
    expect(screen.queryByTestId('customer-home-barber-b')).toBeNull();
    expect(screen.queryByTestId('customer-home-barber-c')).toBeNull();
  });

  it('sends profiles without a city to the editable profile screen', async () => {
    mockFetchOwnProfile.mockResolvedValue({
      status: 'ok',
      profile: { ...profile, city: null, country: null },
    });
    const navigate = jest.fn();

    await render(<DiscoverScreen navigation={{ navigate, addListener: mockAddListener } as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('customer-home-add-city')).toBeTruthy());

    expect(screen.getByText('Add your city to discover verified barbers near you.')).toBeTruthy();
    expect(mockListBarbers).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('customer-home-add-city'));
    expect(navigate).toHaveBeenCalledWith('EditProfile');
  });

  it('reloads the directory on refocus only when the profile city changed', async () => {
    await renderDiscovery();
    expect(mockListBarbers).toHaveBeenCalledTimes(1);

    // Same city (any case/spacing): one profile read, no directory reload.
    mockFetchOwnProfile.mockResolvedValue({ status: 'ok', profile: { ...profile, city: ` ${(profile.city ?? '').toUpperCase()} ` } });
    await act(async () => { focusListener?.(); });
    expect(mockListBarbers).toHaveBeenCalledTimes(1);

    // City edited in Edit profile: the directory reloads for the new city.
    mockFetchOwnProfile.mockResolvedValue({ status: 'ok', profile: { ...profile, city: 'Hamburg' } });
    await act(async () => { focusListener?.(); });
    await waitFor(() => expect(mockListBarbers).toHaveBeenLastCalledWith('Hamburg'));
  });
});

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function booking(id: string, overrides: Partial<BookingRow>): BookingRow {
  return {
    id,
    customer_id: 'customer-1',
    barber_id: 'a',
    service_id: 's1',
    date: dayOffset(3),
    time: '14:30:00',
    location: 'Private address',
    price: 40,
    duration_minutes: 45,
    status: 'pending',
    created_at: '2026-09-21T00:00:00.000Z',
    idempotency_key: null,
    location_latitude: null,
    location_longitude: null,
    slot: null,
    ...overrides,
  };
}

describe('DiscoverScreen personal sections and search', () => {
  const mockFetchBookings = fetchOwnBookingsView as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppLanguage.mockReturnValue('en');
    mockFetchOwnProfile.mockResolvedValue({ status: 'ok', profile });
    mockListBarbers.mockResolvedValue({ status: 'ok', barbers });
    mockListServices.mockResolvedValue({ status: 'ok', services });
  });

  async function renderWith() {
    const navigate = jest.fn();
    await render(<DiscoverScreen navigation={{ navigate, addListener: mockAddListener } as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('customer-home-spotlight')).toBeTruthy());
    return navigate;
  }

  it('shows the soonest live booking as up next and opens Bookings', async () => {
    mockFetchBookings.mockResolvedValue({
      status: 'ok',
      bookings: [
        booking('later', { date: dayOffset(9), status: 'accepted' }),
        booking('soon', { date: dayOffset(1), time: '09:00:00', status: 'pending', price: 42.5 }),
        booking('done', { date: dayOffset(-5), status: 'completed', barber_id: 'b' }),
        booking('gone', { date: dayOffset(-2), status: 'pending' }),
      ],
      barbersById: new Map(barbers.map((row) => [row.id, row])),
      servicesById: new Map(services.map((row) => [row.id, row])),
    });
    const navigate = await renderWith();

    await waitFor(() => expect(screen.getByTestId('customer-home-up-next')).toBeTruthy());
    expect(screen.getByTestId('customer-home-up-next-when').props.children).toBe('Tomorrow · 09:00');
    expect(screen.getByText('Waiting for Amir')).toBeTruthy();
    expect(screen.getByText('€42.50')).toBeTruthy();
    expect(screen.getByText('+1 more booking')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('customer-home-up-next'));
    expect(navigate).toHaveBeenCalledWith('Bookings');
  });

  it('offers book again only for barbers with a completed booking', async () => {
    mockFetchBookings.mockResolvedValue({
      status: 'ok',
      bookings: [booking('done', { date: dayOffset(-5), status: 'completed', barber_id: 'b' })],
      barbersById: new Map(barbers.map((row) => [row.id, row])),
      servicesById: new Map(),
    });
    const navigate = await renderWith();

    await waitFor(() => expect(screen.getByTestId('customer-home-rebook-b')).toBeTruthy());
    expect(screen.queryByTestId('customer-home-rebook-a')).toBeNull();
    expect(screen.queryByTestId('customer-home-up-next')).toBeNull();
    await fireEvent.press(screen.getByTestId('customer-home-rebook-b'));
    expect(navigate).toHaveBeenCalledWith('BarberProfile', { barberId: 'b' });
  });

  it('keeps discovery working when the bookings read fails', async () => {
    mockFetchBookings.mockRejectedValue(new Error('offline'));
    await renderWith();
    expect(screen.queryByTestId('customer-home-up-next')).toBeNull();
    expect(screen.queryByTestId('customer-home-rebook')).toBeNull();
    expect(screen.getByTestId('customer-home-directory')).toBeTruthy();
  });

  it('lists search results with a count and clears them in one tap', async () => {
    await renderWith();
    expect(screen.queryByTestId('customer-home-search-clear')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('customer-home-search'), 'a');
    expect(screen.getByTestId('customer-home-result-count').props.children).toBe('3 results');
    expect(screen.queryByTestId('customer-home-brand-carousel')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('customer-home-search'), 'Benedikt');
    expect(screen.getByTestId('customer-home-result-count').props.children).toBe('1 result');

    await fireEvent.press(screen.getByTestId('customer-home-clear-filters'));
    expect(screen.getByTestId('customer-home-search').props.value).toBe('');
    expect(screen.getByTestId('customer-home-spotlight')).toBeTruthy();
  });

  it('turns a search with no matches into a recoverable empty state', async () => {
    await renderWith();
    await fireEvent.changeText(screen.getByTestId('customer-home-search'), 'zzz');
    expect(screen.getByText('No matches')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('customer-home-empty-clear'));
    expect(screen.getByTestId('customer-home-spotlight')).toBeTruthy();
  });

  it('offers a city change when the city has no barbers yet', async () => {
    mockListBarbers.mockResolvedValue({ status: 'ok', barbers: [] });
    const navigate = jest.fn();
    await render(<DiscoverScreen navigation={{ navigate, addListener: mockAddListener } as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('customer-home-empty')).toBeTruthy());
    expect(screen.getByText('No barbers in Nürnberg yet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('customer-home-empty-change-city'));
    expect(navigate).toHaveBeenCalledWith('EditProfile');
  });
});
