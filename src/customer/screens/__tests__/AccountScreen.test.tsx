import { cleanup, render, screen, waitFor } from '@testing-library/react-native';
import type { UsersRow } from '../../../types';
import { fetchOwnProfile } from '../../../auth/authService';
import AccountScreen from '../AccountScreen';

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
  };
});
jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
jest.mock('../../../RoleContext', () => ({ useExitRole: () => jest.fn() }));
jest.mock('../../../legal/LegalComponents', () => ({ LegalLinks: () => null }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#121214',
      surface: '#1B1B1E',
      border: '#2A2A2E',
      textPrimary: '#F5F1E8',
      textSecondary: '#9A968C',
      accent: '#BFA06B',
      accentText: '#BFA06B',
      errorText: '#CE7A73',
    },
    fonts: { headingMedium: 'serif', body: 'sans', bodySemiBold: 'sans', bodyMedium: 'sans' },
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement(View, props, children),
  };
});

const profile: UsersRow = {
  id: 'customer-1',
  name: 'Nora Hassan',
  email: 'nora@example.com',
  phone: null,
  role: 'customer',
  city: 'Berlin',
  country: 'Germany',
  profile_image: null,
  created_at: '2026-09-01T10:00:00.000Z',
};

const mockFetchProfile = jest.mocked(fetchOwnProfile);

beforeEach(() => {
  mockFetchProfile.mockReset();
  mockFetchProfile.mockResolvedValue({ status: 'ok', profile });
});

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

describe('AccountScreen avatar integration', () => {
  it('does not show a placeholder member identity while the real profile loads', async () => {
    mockFetchProfile.mockImplementation(() => new Promise(() => {}));
    await render(<AccountScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    expect(screen.getByTestId('customer-account-loading').props.accessibilityLabel).toBe('Loading profile');
    expect(screen.queryByTestId('customer-account-edit-profile')).toBeNull();
    expect(screen.queryByText('Member')).toBeNull();
    expect(screen.getByTestId('customer-account-logout')).toBeTruthy();
  });

  it('keeps retry available without inventing member data on a load failure', async () => {
    mockFetchProfile.mockResolvedValue({ status: 'error', code: 'network', retryable: true, message: 'Could not load profile.' });
    await render(<AccountScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('customer-account-error')).toBeTruthy());
    expect(screen.queryByTestId('customer-account-edit-profile')).toBeNull();
    expect(screen.queryByText('Member')).toBeNull();
  });

  it('replaces the neutral loading disc with the signed-in member monogram', async () => {
    await render(<AccountScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('customer-account-avatar')).toBeTruthy());
    expect(screen.queryByTestId('customer-account-avatar-placeholder')).toBeNull();
    expect(screen.getByTestId('customer-account-avatar-monogram').props.children).toBe('NH');
    expect(screen.getByTestId('customer-account-avatar').props.accessible).toBe(false);
    expect(screen.getByTestId('customer-account-edit-profile').props.accessibilityLabel).toBe('Edit profile');
  });
});
