import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { BarberDirectoryRow, UsersRow } from '../../../types';
import { fetchOwnProfile } from '../../../auth/authService';
import { listBarbersByCity, listServicesForBarberIds } from '../../discoveryData';
import DiscoverScreen from '../DiscoverScreen';

jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
jest.mock('../../../shared/components/NotificationBell', () => ({ NotificationBell: () => null }));
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
  city: 'Nuremberg',
  country: 'Germany',
  profile_image: null,
  created_at: '2026-09-21T00:00:00.000Z',
};

const amir: BarberDirectoryRow = {
  id: 'a',
  name: 'Amir',
  city: 'Nuremberg',
  country: 'Germany',
  profile_image: null,
  bio: null,
  rating: 0,
  verified: true,
  display_latitude: null,
  display_longitude: null,
};

describe('DiscoverScreen service-enrichment failure', () => {
  it('retries directory errors and keeps name discovery without service claims', async () => {
    mockFetchOwnProfile.mockResolvedValue({ status: 'ok', profile });
    mockListBarbers
      .mockResolvedValueOnce({
        status: 'error',
        code: 'network',
        message: 'Discovery is unavailable.',
        retryable: true,
      })
      .mockResolvedValueOnce({ status: 'ok', barbers: [amir] });
    mockListServices.mockResolvedValue({
      status: 'error',
      code: 'network',
      message: 'Services are unavailable.',
      retryable: true,
    });

    await render(
      <DiscoverScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
    );
    await waitFor(() => expect(screen.getByTestId('customer-home-error')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByTestId('customer-home-retry'));
    });
    await waitFor(() => expect(screen.getByTestId('customer-home-barber-a')).toBeTruthy());

    expect(screen.queryByLabelText('Filter by Fade')).toBeNull();
    expect(screen.queryByText('Fade')).toBeNull();
    expect(screen.queryByText(/from /i)).toBeNull();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('customer-home-search'), 'Fade');
    });
    expect(screen.getByTestId('customer-home-empty')).toBeTruthy();
    expect(screen.queryByTestId('customer-home-spotlight')).toBeNull();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('customer-home-search'), 'Amir');
    });
    expect(screen.getByTestId('customer-home-barber-a')).toBeTruthy();
    expect(screen.queryByTestId('customer-home-spotlight')).toBeNull();
  });
});
