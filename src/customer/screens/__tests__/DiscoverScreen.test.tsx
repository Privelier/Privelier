import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { BarberDirectoryRow, ServiceRow, UsersRow } from '../../../types';
import { fetchOwnProfile } from '../../../auth/authService';
import { listBarbersByCity, listServicesForBarberIds } from '../../discoveryData';
import DiscoverScreen from '../DiscoverScreen';

jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
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
const mockListBarbers = listBarbersByCity as jest.Mock;
const mockListServices = listServicesForBarberIds as jest.Mock;

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
  });

  async function renderDiscovery() {
    mockFetchOwnProfile.mockResolvedValue({ status: 'ok', profile });
    mockListBarbers.mockResolvedValue({ status: 'ok', barbers });
    mockListServices.mockResolvedValue({ status: 'ok', services });
    const navigate = jest.fn();

    await render(<DiscoverScreen navigation={{ navigate } as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByText('Barber spotlight')).toBeTruthy());
    return navigate;
  }

  it('renders truthful discovery for the profile city', async () => {
    await renderDiscovery();

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

    await render(<DiscoverScreen navigation={{ navigate } as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByTestId('customer-home-add-city')).toBeTruthy());

    expect(screen.getByText('Add your city to discover verified barbers near you.')).toBeTruthy();
    expect(mockListBarbers).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('customer-home-add-city'));
    expect(navigate).toHaveBeenCalledWith('EditProfile');
  });
});
