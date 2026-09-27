import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExploreScreen from '../ExploreScreen';
import { fetchOwnProfile } from '../../../auth/authService';
import { listAvailabilityForBarberIds } from '../../availabilityData';
import { listBarbersByCity, listServicesForBarberIds } from '../../discoveryData';
import { getAppLanguage } from '../../../shared/locale';

jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
jest.mock('../../availabilityData', () => ({ listAvailabilityForBarberIds: jest.fn() }));
jest.mock('../../discoveryData', () => ({ listBarbersByCity: jest.fn(), listServicesForBarberIds: jest.fn() }));
jest.mock('../../../shared/locale', () => ({ getAppLanguage: jest.fn(() => 'en') }));
jest.mock('../../../shared/components/RetryNotice', () => ({ RetryNotice: () => null }));
jest.mock('../../components/BarberCard', () => () => null);
jest.mock('../../mapRuntime', () => ({ hasMapboxPublicToken: () => false, isMapNativeAvailable: () => false }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { background: '#121214', surface: '#1B1B1E', border: '#2A2A2E', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B', accentText: '#BFA06B', onAccent: '#121214' },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans' },
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children, ...props }: { children?: unknown }) => React.createElement(View, props, children) };
});

const mockLanguage = getAppLanguage as jest.MockedFunction<typeof getAppLanguage>;

describe('ExploreScreen map fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage.mockReturnValue('en');
    (fetchOwnProfile as jest.Mock).mockResolvedValue({ status: 'ok', profile: { city: 'Berlin' } });
    (listBarbersByCity as jest.Mock).mockResolvedValue({ status: 'ok', barbers: [] });
    (listServicesForBarberIds as jest.Mock).mockResolvedValue({ status: 'ok', services: [] });
    (listAvailabilityForBarberIds as jest.Mock).mockResolvedValue({ status: 'ok', windows: [] });
  });

  async function renderExplore() {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<ExploreScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByTestId('customer-explore-loading')).toBeNull());
    return view;
  }

  it('explains the Expo Go limitation and offers a direct return to the list', async () => {
    await renderExplore();
    await waitFor(() => expect(screen.getByTestId('customer-explore-toggle-map')).toBeTruthy());
    fireEvent.press(screen.getByTestId('customer-explore-toggle-map'));

    expect(await screen.findByText(/Expo Go does not include the native map/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('customer-explore-map-switch-to-list'));
    await waitFor(() => expect(screen.queryByTestId('customer-explore-map-area')).toBeNull());
  });

  it('localizes the map fallback and its accessible action in German', async () => {
    mockLanguage.mockReturnValue('de');
    await renderExplore();
    await waitFor(() => expect(screen.getByTestId('customer-explore-toggle-map')).toBeTruthy());
    fireEvent.press(screen.getByTestId('customer-explore-toggle-map'));

    expect(await screen.findByText(/Expo Go enthält keine native Karte/)).toBeTruthy();
    expect(screen.getByTestId('customer-explore-map-switch-to-list').props.accessibilityLabel).toBe('Zur Liste wechseln');
  });
});
